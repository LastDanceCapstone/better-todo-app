import { TASK_PARSER_SYSTEM_PROMPT } from './taskParserPrompt';

export type ParsedTask = {
  title: string | null;
  description: string | null;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  labels: string[] | null;
  subtasks: string[] | null;
};

export async function parseTaskText(text: string): Promise<ParsedTask> {
  const lower = text.toLowerCase();

  const priority =
    lower.includes('high') ? 'HIGH' :
    lower.includes('medium') ? 'MEDIUM' :
    lower.includes('low') ? 'LOW' :
    null;

  let labels: string[] | null = null;
  const labelMatch = text.match(/labels?\s*:\s*(.+)$/i);
  if (labelMatch?.[1]) {
    labels = labelMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  let subtasks: string[] | null = null;
  const subMatch = text.match(/subtasks?\s*:\s*(.+)$/i);
  if (subMatch?.[1]) {
    subtasks = subMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  const title = text.split(',')[0]?.trim() || null;

  return {
    title,
    description: null,
    dueDate: null,
    priority,
    labels,
    subtasks,
  };
}

export { TASK_PARSER_SYSTEM_PROMPT };
