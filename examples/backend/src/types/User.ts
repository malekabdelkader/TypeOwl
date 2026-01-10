export interface CreateUserInput {
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface User extends CreateUserInput {
  id: string;
}
