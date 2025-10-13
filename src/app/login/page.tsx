import { login } from './action';

export default function Login() {
  return (
    <div className="my-auto flex size-full items-center justify-center **:[input]:ring-1 **:[input]:ring-slate-200">
      <form className="w-full max-w-3xl space-y-4 *:w-full">
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
