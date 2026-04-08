import { $remark } from '@milkdown/utils';
import remarkDirective from 'remark-directive';

export const sharedRemarkDirective = $remark(
  'sharedRemarkDirective',
  () => remarkDirective,
);
