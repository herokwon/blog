export function readFormText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export function positiveInteger(value: string) {
  const integer = Number(value);
  return /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(integer)
    ? integer
    : undefined;
}
