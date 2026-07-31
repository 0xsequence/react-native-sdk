function command(name, files) {
  return `${name} ${files.map((file) => JSON.stringify(file)).join(' ')}`;
}

export default {
  '*.{js,cjs,mjs,ts,tsx}': (files) => [
    command('eslint --fix', files),
    command('prettier --write', files),
  ],
  '*.{json,yaml,yml}': (files) => command('prettier --write', files),
};
