import { LoginButton } from './LoginButton';

export const LoginForm = ({ redirect }: { redirect?: string }) => {
  return (
    <form role="form" className="w-full max-w-3xl space-y-4 *:w-full">
      <input type="hidden" name="redirect" value={redirect ?? '/'} />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" required />
      <LoginButton />
    </form>
  );
};
