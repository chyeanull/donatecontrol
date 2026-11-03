import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { defaults, schemas, type Replicants, type SettingsState } from '../src/shared/models';
import { providerFixture, type FixtureProvider } from './helpers/providerFixture';

// Provider pacing is verified separately. Fake clocks let these integration tests
// exercise recovery and polling without waiting for real multi-minute backoffs.
vi.mock('node:timers/promises', () => ({ setTimeout: async () => {} }));
const services: CampaignService[] = [];
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T12:00:00Z')); });
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.disconnect())); vi.useRealTimers(); vi.unstubAllGlobals(); });
const old = '2026-11-02T12:00:00Z';
async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  const result = promise.then(value => ({value}), error => ({error})).finally(() => {done = true;});
  for (let i=0; i<100 && !done; i++) await vi.advanceTimersByTimeAsync(50);
  if (!done) throw new Error('Fixture operation did not finish within 5 seconds');
  const outcome = await result;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}
function setup(kind: FixtureProvider, resource: NonNullable<SettingsState['donorDriveResource']> = 'events', initial = structuredClone(defaults)) {
  const api = providerFixture(kind,resource);
  vi.stubGlobal('fetch',api.fetcher);
  const state = initial;
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
    set: <K extends keyof Replicants>(key: K,value:Replicants[K]) => {schemas[key].parse(value);state[key]=structuredClone(value);},
  };
  const service = new CampaignService(store,()=>{},()=>({clientId:'fixture-id',clientSecret:'fixture-secret'}),()=> 'fixture-key');
  services.push(service);
  const settings: SettingsState = {...defaults.settings,provider:kind,campaignId:'42',
    campaignUrl:kind === 'donordrive' ? 'https://fixture.donordrive.com/test' : '', donorDriveResource:resource,
    pollingIntervalSeconds:300,alertDurationSeconds:2};
  const poll = async () => {vi.setSystemTime(Date.now()+16000);await settle(service.refresh());};
  return {api,state,service,settings,poll};
}

describe.each(['gofundme-pro','givebutter','donordrive'] as const)('%s HTTP → provider → campaign → archive → alert flow', kind => {
  it('imports every historical page without alerts, respects privacy, and updates totals from the provider', async () => {
    const {api,state,service,settings} = setup(kind);
    for(let i=1;i<=105;i++) api.add(String(i),old);
    api.add('106',old,{name:null}); api.add('107',old,{hidden:true}); api.add('108',old,{failed:true});
    if(kind==='givebutter') api.add('109',old,{otherCampaign:true});
    await settle(service.connect(settings));
    expect(state.donationHistory).toHaveLength(106);
    expect(state.donationHistory.every(entry=>entry.sentCount===0)).toBe(true);
    expect(state.currentAlert).toMatchObject({visible:false,queued:0});
    expect(state.campaign).toMatchObject({raised:250,goal:1000,percent:25,connected:true});
    expect(state.donationHistory.find(entry=>entry.donation.anonymous)?.donorName).toBe('Anonymous');
    expect(JSON.stringify(state)).not.toMatch(/PRIVATE|private@example|fixture-secret|fixture-token|fixture-key/);
    expect(api.requests.some(request=>request.page===2)).toBe(true);
    expect(state.campaignHistory).toHaveLength(1);
  });
  it('monitors arrivals once, holds manual donations, sends edited text, resets, and preserves the archive on reconnect', async () => {
    const {api,state,service,settings,poll} = setup(kind);
    api.add('1',old); await settle(service.connect(settings));
    api.add('2',new Date().toISOString()); api.state.raised=260;
    await poll();
    expect(state.currentAlert.donation?.donorName).toBe('Donor 2');
    expect(state.donationHistory.map(e=>e.sentCount)).toEqual([0,1]);
    expect(state.campaign.percent).toBe(26);
    await poll(); expect(state.currentAlert.queued).toBe(0); expect(state.donationHistory).toHaveLength(2);
    service.alerts.stop(); service.setManualAlertControl({manual:true});
    api.add('3',new Date().toISOString()); api.state.raised=270; await poll();
    const entry = state.donationHistory.find(e=>e.donorName==='Donor 3')!;
    expect(entry.sentCount).toBe(0); expect(state.currentAlert.visible).toBe(false); expect(state.campaign.raised).toBe(270);
    service.editDonation({entryId:entry.id,donorName:'Producer edit',message:'Edited public text'});
    service.sendDonation({entryId:entry.id}); service.sendDonation({entryId:entry.id});
    expect(state.currentAlert.donation).toMatchObject({donorName:'Producer edit',message:'Edited public text'});
    expect(state.donationHistory.find(e=>e.id===entry.id)?.sentCount).toBe(1);
    await vi.advanceTimersByTimeAsync(2900);
    expect(state.donationHistory.find(e=>e.id===entry.id)?.sentCount).toBe(2);
    service.resetDonation({entryId:entry.id});
    expect(state.donationHistory.find(e=>e.id===entry.id)).toMatchObject({donorName:'Donor 3',editedAt:null,sentCount:2});
    expect(state.campaign.raised).toBe(270);
    await service.disconnect();
    const saved = structuredClone(state.donationHistory);
    await settle(service.connect(settings));
    expect(state.donationHistory).toEqual(saved); expect(state.currentAlert.visible).toBe(false);
    service.setManualAlertControl({manual:false});
    api.add('4',new Date().toISOString()); await poll();
    expect(state.currentAlert.donation?.donorName).toBe('Donor 4');
    expect(state.donationHistory.map(e=>e.sentCount)).toEqual([0,1,2,1]);
  });
  it('captures a burst larger than a page after an empty baseline without losing or replaying entries', async () => {
    const {api,state,service,settings,poll} = setup(kind);
    await settle(service.connect(settings)); service.setManualAlertControl({manual:true});
    const stamp = new Date().toISOString();
    for(let i=1;i<=105;i++) api.add(String(i),stamp);
    api.state.raised=1300; await poll();
    expect(state.donationHistory).toHaveLength(105); expect(state.campaign.percent).toBe(130);
    await poll(); expect(state.donationHistory).toHaveLength(105); expect(state.currentAlert.visible).toBe(false);
  });
  it('commits no partial snapshot on a failed second page, then catches up automatically after Retry-After', async () => {
    const {api,state,service,settings,poll} = setup(kind);
    await settle(service.connect(settings));
    const stamp = new Date().toISOString();
    for(let i=1;i<=105;i++) api.add(String(i),stamp);
    api.state.raised=1300;
    api.state.error={status:429,path:kind==='donordrive'?'/donations':'/transactions',page:2,retryAfter:'700'};
    await expect(poll()).rejects.toMatchObject({retryable:true,retryAfterMs:700000});
    expect(state.donationHistory).toEqual([]); expect(state.campaign.raised).toBe(250);
    expect(state.connectionStatus).toMatchObject({state:'error'}); expect(state.campaign.connected).toBe(false);
    expect(state.currentAlert.visible).toBe(false); expect(state.donationLedger.seenIds).toEqual([]);
    const calls=api.requests.length;
    await expect(service.refresh()).rejects.toThrow('retry delay'); expect(api.requests).toHaveLength(calls);
    api.state.error=null;
    await vi.advanceTimersByTimeAsync(701000);
    expect(state.connectionStatus.state).toBe('connected'); expect(state.campaign.raised).toBe(1300);
    expect(state.donationHistory).toHaveLength(105);
    expect(state.donationHistory.filter(e=>e.sentCount===1)).toHaveLength(1);
    expect(state.currentAlert.queued).toBe(104);
  });
  it('rejects a response for the wrong campaign without importing data', async () => {
    const {api,state,service,settings} = setup(kind);
    api.state.wrongId=true;
    await expect(settle(service.connect(settings))).rejects.toThrow(/different (campaign|fundraiser)/);
    expect(state.donationHistory).toHaveLength(0); expect(state.campaign.connected).toBe(false);
  });
  it('keeps arrivals during a slow initial scan eligible for alerting on the next poll', async () => {
    const {api,state,service,settings,poll} = setup(kind);
    let first = true;
    vi.stubGlobal('fetch',async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const response = await api.fetcher(input,init);
      if(first && /\/(transactions|donations)(\?|$)/.test(String(input))) {
        first=false;
        const during = new Date(Date.now()+1000).toISOString();
        vi.setSystemTime(Date.now()+2000);
        api.add('50',during);
      }
      return response;
    });
    // Recreate service after installing the wrapped transport (providers capture fetch).
    await service.disconnect();
    const store: StateStore = {get:key=>structuredClone(state[key]),set:(key,value)=>{schemas[key].parse(value);(state[key] as unknown)=structuredClone(value);}};
    const slow = new CampaignService(store,()=>{},()=>({clientId:'fixture-id',clientSecret:'fixture-secret'}),()=> 'fixture-key');
    services.push(slow);
    await settle(slow.connect(settings));
    vi.setSystemTime(Date.now()+16000); await settle(slow.refresh());
    expect(state.donationHistory).toHaveLength(1);
    expect(state.currentAlert.donation?.donorName).toBe('Donor 50');
    expect(state.donationHistory[0].sentCount).toBe(1);
  });
});

it.each(['participants','teams','events'] as const)('imports and monitors a DonorDrive %s campaign',async resource=>{
 const {api,state,service,settings,poll}=setup('donordrive',resource);
 api.add('1',old);await settle(service.connect(settings));
 api.add('2',new Date().toISOString());api.state.goal=null;api.state.raised=300;await poll();
 expect(state.campaign).toMatchObject({id:`${resource}/42`,goal:0,percent:0,raised:300});
 expect(state.currentAlert.donation?.donorName).toBe('Donor 2');
 expect(state.donationLedger.campaignKey).toBe(`donordrive:https://fixture.donordrive.com:${resource}/42`);
});

it.each(['gofundme-pro','givebutter','donordrive'] as const)('%s supports missing goals and non-USD donations without deriving totals from visible donations',async kind=>{
 const {api,state,service,settings,poll}=setup(kind);
 api.state.currency='EUR';api.state.goal=null;
 await settle(service.connect(settings));
 expect(state.campaign).toMatchObject({currency:'EUR',raised:250,goal:0,percent:0});
 api.add('1',new Date().toISOString(),{amount:12.5});api.state.raised=400;api.state.goal=300;
 await poll();
 expect(state.campaign).toMatchObject({currency:'EUR',raised:400,goal:300});
 expect(state.campaign.percent).toBeCloseTo(133.333);
 expect(state.currentAlert.donation).toMatchObject({currency:'EUR',amount:12.5});
});

it.each(['gofundme-pro','givebutter','donordrive'] as const)('%s stops retrying denied access and keeps saved records without exposing campaign data',async kind=>{
 const {api,state,service,settings,poll}=setup(kind);
 api.add('1',old);await settle(service.connect(settings));
 const history=structuredClone(state.donationHistory);
 api.state.error={status:403,path:kind==='donordrive'?'/api/events':'/campaigns'};
 await expect(poll()).rejects.toMatchObject({retryable:false});
 expect(state.connectionStatus).toMatchObject({state:'error',nextRetryAt:null});
 expect(state.campaign.connected).toBe(false);expect(state.currentAlert.visible).toBe(false);
 expect(state.donationHistory).toEqual(history);
 const requests=api.requests.length;
 await vi.advanceTimersByTimeAsync(900000);
 await expect(service.refresh()).rejects.toThrow('Reconnect');
 expect(api.requests).toHaveLength(requests);
});

it.each(['gofundme-pro','givebutter','donordrive'] as const)('%s leaves a failed initial paginated import uncommitted and baselines it after recovery',async kind=>{
 const {api,state,service,settings}=setup(kind);
 for(let i=1;i<=105;i++) api.add(String(i),old);
 api.state.error={status:503,path:kind==='donordrive'?'/donations':'/transactions',page:2};
 await expect(settle(service.connect(settings))).rejects.toMatchObject({retryable:true});
 expect(state.donationHistory).toEqual([]);expect(state.campaignHistory).toEqual([]);
 expect(state.donationLedger.seenIds).toEqual([]);
 api.state.error=null;
 await vi.advanceTimersByTimeAsync(601000);
 expect(state.connectionStatus.state).toBe('connected');expect(state.donationHistory).toHaveLength(105);
 expect(state.donationHistory.every(entry=>entry.sentCount===0)).toBe(true);expect(state.currentAlert.visible).toBe(false);
});

it.each(['gofundme-pro','givebutter'] as const)('%s conservatively saves an older payment that settles after connection for manual sending',async kind=>{
 const {api,state,service,settings,poll}=setup(kind);
 api.add('1',old,{failed:true});await settle(service.connect(settings));
 expect(state.donationHistory).toHaveLength(0);
 api.state.donations[0].failed=false;api.state.revision++;
 await poll();
 expect(state.donationHistory).toHaveLength(1);
 expect(state.donationHistory[0].sentCount).toBe(0);expect(state.currentAlert.visible).toBe(false);
 service.sendDonation({entryId:state.donationHistory[0].id});
 expect(state.currentAlert.donation?.donorName).toBe('Donor 1');
});
