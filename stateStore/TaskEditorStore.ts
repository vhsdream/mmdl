import { atom } from 'jotai'
import { ParsedTask } from 'types/tasks/tasks'

export interface TaskEditorInputType{
    id: string | number | null,
    parentId?: string,
    category?: string[],
    priority?:number,
    taskDone?: boolean,
    due?: Date,
    start?:Date,
    summary?:string,
    calendar_id?:string | number,
    isTemplate?: boolean,
    rrule?:string,
    completion?:string | number,
    status?:string,
    description?:string,

    templateReturn?:Function,

}
export const showTaskEditorAtom = atom(false)
export const taskEditorInputAtom = atom<TaskEditorInputType>({id: null})

