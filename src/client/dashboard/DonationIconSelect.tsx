import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { donationIconNames, type DonationIconName } from '../../shared/models';
import { DonationIcon } from '../shared/DonationIcon';

const choices = Object.entries(donationIconNames) as [DonationIconName, string][];

export function DonationIconSelect({ value, disabled, describedBy, onChange }: {
  value: DonationIconName; disabled: boolean; describedBy: string; onChange: (icon: DonationIconName) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 0 });
  const selected = choices.findIndex(([name]) => name === value);
  const expanded = open && !disabled;

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!expanded) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) { setOpen(false); return; }
      const below = innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const down = below >= 408 || below >= above;
      const maxHeight = Math.max(0, Math.min(408, down ? below : above));
      const width = Math.min(rect.width, innerWidth - 16);
      setPosition({ top: down ? rect.bottom + 6 : rect.top - 6 - maxHeight,
        left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)), width, maxHeight });
    };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) place(); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true); };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: Event) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); };
  }, [expanded]);

  useLayoutEffect(() => {
    if (expanded) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded, position.maxHeight, id]);

  const show = (index = selected) => { typed.current = { text: '', at: 0 }; setActive(index); setOpen(true); };
  const choose = (index: number) => { onChange(choices[index][0]); setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    if (key === 'Tab') { setOpen(false); return; }
    if (key === 'Escape') { if (expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); } return; }
    if (key === 'Enter' || key === ' ') { event.preventDefault(); expanded ? choose(active) : show(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      const next = key === 'Home' ? 0 : key === 'End' ? choices.length - 1
        : expanded ? (active + (key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length : selected;
      expanded ? setActive(next) : show(next);
      return;
    }
    if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - typed.current.at < 700 ? typed.current.text : '') + key.toLowerCase();
      const query = [...text].every(char => char === text[0]) ? text[0] : text;
      typed.current = { text, at: now };
      const start = expanded ? active : selected;
      for (let offset = 1; offset <= choices.length; offset++) {
        const index = (start + offset) % choices.length;
        if (choices[index][1].toLowerCase().startsWith(query)) { setActive(index); setOpen(true); break; }
      }
    }
  };

  return <div className="custom-icon-field">
    <span className="custom-icon-label" id={`${id}-label`}>Icon</span>
    <button ref={trigger} id="overlay-icon" className="custom-icon-trigger" type="button" role="combobox"
      disabled={disabled} aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
      aria-labelledby={`${id}-label ${id}-value`} aria-describedby={describedBy}
      aria-activedescendant={expanded ? `${id}-option-${active}` : undefined}
      onKeyDown={keyDown} onClick={() => expanded ? setOpen(false) : show()}>
      <DonationIcon name={value}/><span id={`${id}-value`}>{donationIconNames[value]}</span>
      <svg className="custom-icon-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>
    {expanded && createPortal(<div ref={menu} id={`${id}-list`} className="custom-icon-menu" role="listbox" aria-labelledby={`${id}-label`} style={position}>
      {choices.map(([name, label], index) => <div key={name} id={`${id}-option-${index}`} className="custom-icon-option" role="option"
        aria-selected={name === value} data-active={active === index ? '' : undefined}
        onPointerMove={(event) => { if (event.pointerType === 'mouse') setActive(index); }}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
        <DonationIcon name={name}/><span>{label}</span>
        {name === value && <svg className="custom-icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}
      </div>)}
    </div>, document.body)}
  </div>;
}
