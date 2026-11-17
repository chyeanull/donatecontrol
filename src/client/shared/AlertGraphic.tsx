import type { ComponentProps } from 'react';
import { AlertCanvas } from './AlertCanvas';
import { AlertCard } from './Graphics';
import { MustacheRiderReceipt } from './MustacheRiderReceipt';

export function AlertGraphic({ preview = false, animate = true, ...props }: ComponentProps<typeof AlertCard> & { preview?: boolean; animate?: boolean }) {
  if (props.theme === 'mustacherider') return <MustacheRiderReceipt alert={props.alert} animate={animate}/>;
  return <AlertCanvas className={preview ? 'mini-alert' : ''} maxScale={preview ? .84 : 1} padding={preview ? 24 : 12}><AlertCard {...props}/></AlertCanvas>;
}
