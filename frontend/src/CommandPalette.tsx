import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Search} from 'lucide-react';
import {api,type Task,type User} from './api';
import {CommandDialog,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from './components/ui/command';

type Props={
  open:boolean;
  onClose:()=>void;
  onNavigate:(screen:string)=>void;
  onTask:(id:number)=>void;
  projectId:number|null;
  role:User['role'];
  canReview:boolean;
};
const pages=[
  {name:'Overview',screen:'overview'},
  {name:'My work',screen:'mine'},
  {name:'Projects',screen:'projects'},
  {name:'Tasks',screen:'tasks'},
  {name:'My submissions',screen:'submissions'},
  {name:'Review',screen:'pending'},
  {name:'Reports',screen:'reports'},
  {name:'Settings',screen:'settings'},
  {name:'Accounts',screen:'accounts'}
];

export default function CommandPalette({open,onClose,onNavigate,onTask,projectId,role,canReview}:Props){
  const [search,setSearch]=useState('');
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:open&&!!projectId&&role!=='ADMIN'});
  function selectPage(screen:string){onNavigate(screen);onClose();setSearch('')}
  function selectTask(id:number){onTask(id);onClose();setSearch('')}
  return <CommandDialog open={open} onOpenChange={value=>{if(!value)onClose()}}>
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-3">
      <Search size={17} strokeWidth={1.5} aria-hidden="true" className="text-[var(--accent)]"/>
      <CommandInput autoFocus data-testid="command-search-input" value={search} onValueChange={setSearch} placeholder="Find a page or task" aria-label="Find a page or task"/>
      <kbd>ESC</kbd>
    </div>
    <CommandList>
      <CommandEmpty>No matching pages or tasks.</CommandEmpty>
      <CommandGroup heading="PAGES">
        {pages.filter(page=>role==='PM'? !['mine','accounts'].includes(page.screen):role==='ADMIN'?page.screen==='accounts':role==='REVIEWER'?['pending','tasks'].includes(page.screen):['mine','projects','tasks','submissions',...(canReview?['pending']:[])].includes(page.screen)).map(page=><CommandItem data-testid={`command-page-${page.screen}`} key={page.screen} value={page.name} onSelect={()=>selectPage(page.screen)}>{page.name}<span className="text-xs text-[var(--muted)]">Open page</span></CommandItem>)}
      </CommandGroup>
      {!!tasks.data?.length&&<CommandGroup heading="TASKS">
        {tasks.data.map(task=><CommandItem data-testid={`command-task-${task.id}`} key={task.id} value={task.title} onSelect={()=>selectTask(task.id)}>{task.title}<span className="text-xs text-[var(--muted)]">{task.status.replaceAll('_',' ')}</span></CommandItem>)}
      </CommandGroup>}
    </CommandList>
  </CommandDialog>;
}
