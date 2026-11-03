function initials(name:string){return name.trim().split(/\s+/).map(part=>part[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'?'}
function tone(name:string){let value=0;for(const character of name)value=(value*31+character.charCodeAt(0))%5;return value}

export function Avatar({name,size='normal'}:{name:string;size?:'normal'|'small'}){
  return <span className={`avatar-initials avatar-tone-${tone(name)}${size==='small'?' avatar-small':''}`} aria-hidden="true">{initials(name)}</span>;
}

export function OwnerName({name}:{name:string}){
  return <span className="owner-name"><Avatar name={name}/><span>{name}</span></span>;
}
