import { login } from './action';

type LoginProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function Login({ searchParams }: LoginProps) {
  const { redirect } = await searchParams;

  return (
    <div className="my-auto flex size-full items-center justify-center **:[input]:ring-1 **:[input]:ring-slate-200">
      <form className="w-full max-w-3xl space-y-4 *:w-full">
        <input type="hidden" name="redirect" value={redirect ?? '/'} />
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
        <button formAction={login} className="cursor-pointer bg-slate-200">
          Login
        </button>
      </form>
    </div>
  );
}
