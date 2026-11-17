const chickenImage = new URL('./images/cs2-chicken.png', import.meta.url).href;

export function CounterStrikeChicken() {
  return <img className="cs2-chicken" src={chickenImage} width="640" height="480" alt="" aria-hidden="true" draggable={false}/>;
}
