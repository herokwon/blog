import { Trash2 } from 'lucide-react';

export const RemoveButton = ({
  ...props
}: React.ComponentPropsWithoutRef<'button'>) => {
  return (
    <button {...props} className="flex cursor-pointer items-center gap-x-2">
      <Trash2 size={16} />
      삭제
    </button>
  );
};
