import { BookPlus, LucideIcon, SquarePen, Trash2 } from 'lucide-react';

type PostButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  icon: LucideIcon;
  label: string;
};

const PostButton = ({ icon: Icon, label, ...props }: PostButtonProps) => {
  return (
    <button
      {...props}
      className={`flex cursor-pointer items-center gap-x-2 ${props.className ?? ''}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
};

export const PublishButton = (
  props: React.ComponentPropsWithoutRef<'button'>,
) => <PostButton {...props} icon={BookPlus} label="발행" />;

export const UpdateButton = (
  props: React.ComponentPropsWithoutRef<'button'>,
) => <PostButton {...props} icon={SquarePen} label="수정" />;

export const RemoveButton = (
  props: React.ComponentPropsWithoutRef<'button'>,
) => <PostButton {...props} icon={Trash2} label="삭제" />;
