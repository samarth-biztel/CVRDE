import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {Command as CommandPrimitive} from 'cmdk';
import {cn} from '../../lib/utils';

export function Command({className,...props}:React.ComponentProps<typeof CommandPrimitive>){
  return <CommandPrimitive className={cn('flex w-full flex-col bg-[var(--surface)] text-[var(--text)]',className)} {...props}/>;
}
export function CommandDialog({open,onOpenChange,children}:{open:boolean;onOpenChange:(open:boolean)=>void;children:React.ReactNode}){
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60"/>
    <Dialog.Content data-testid="command-palette" className="fixed top-[12vh] left-1/2 z-50 flex w-[min(620px,calc(100vw-32px))] -translate-x-1/2 flex-col border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[12px_12px_0_0_#09090b35] outline-none">
      <Dialog.Title className="sr-only">Search workspace</Dialog.Title>
      <Command>{children}</Command>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function CommandInput({className,...props}:React.ComponentProps<typeof CommandPrimitive.Input>){
  return <CommandPrimitive.Input className={cn('min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-sm text-[var(--text)] shadow-none outline-none placeholder:text-[var(--muted)]',className)} {...props}/>;
}
export function CommandList({className,...props}:React.ComponentProps<typeof CommandPrimitive.List>){
  return <CommandPrimitive.List className={cn('max-h-[min(62vh,570px)] overflow-y-auto p-3',className)} {...props}/>;
}
export function CommandEmpty({className,...props}:React.ComponentProps<typeof CommandPrimitive.Empty>){
  return <CommandPrimitive.Empty className={cn('px-3 py-5 text-sm text-[var(--muted)]',className)} {...props}/>;
}
export function CommandGroup({className,...props}:React.ComponentProps<typeof CommandPrimitive.Group>){
  return <CommandPrimitive.Group className={cn('mb-3 text-sm [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[.65rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-[.2em] [&_[cmdk-group-heading]]:text-[var(--muted)]',className)} {...props}/>;
}
export function CommandItem({className,...props}:React.ComponentProps<typeof CommandPrimitive.Item>){
  return <CommandPrimitive.Item className={cn('flex cursor-pointer items-center justify-between gap-4 px-3 py-3 text-sm outline-none data-[selected=true]:bg-[var(--accent-soft)] data-[selected=true]:text-[var(--accent)]',className)} {...props}/>;
}
