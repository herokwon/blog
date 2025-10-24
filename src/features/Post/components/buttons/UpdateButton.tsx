import { SquarePen } from 'lucide-react';

export const UpdateButton = ({
  ...props
}: React.ComponentPropsWithoutRef<'button'>) => {
  return (
    <button {...props} className="flex cursor-pointer items-center gap-x-2">
      <SquarePen size={16} />
      수정
    </button>
  );
};
