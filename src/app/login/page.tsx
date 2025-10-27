import { LoginForm } from '@/features/Auth';

type LoginProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function Login({ searchParams }: LoginProps) {
  const { redirect } = await searchParams;

  return (
    <div className="my-auto flex size-full items-center justify-center **:[input]:ring-1 **:[input]:ring-slate-200">
      <LoginForm redirect={redirect} />
    </div>
  );
}
