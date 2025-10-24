import { BookPlus } from 'lucide-react';

export const PublishButton = ({
  ...props
}: React.ComponentPropsWithoutRef<'button'>) => {
  return (
    <button {...props} className="flex cursor-pointer items-center gap-x-2">
      <BookPlus size={16} />
      발행
    </button>
  );
};
