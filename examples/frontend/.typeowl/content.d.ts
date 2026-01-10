/**
 * 🦉 TypeOwl Generated Types
 * Domain: content
 * Version: 1.0.0
 * Generated: 2026-01-10T14:59:06.286Z
 * DO NOT EDIT - This file is auto-generated
 */

export type Blog = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  author?: Author;
}

export type Author = {
    isDeveloper: boolean;
    developers: Map<string, Developer>;
    customType: customeType<string>;
};

export type Developer = {
  id: string;
  name: string;
  email: string;
  role: DeveloperRole;
};

export type DeveloperRole = 'admin' | 'user' | 'guest';

export type customeType<T extends string | number> = `custom_${T}`;

export type  BlogInput = Pick<Blog, 'title' | 'content'>;

export interface Product {
    id: string;
    name: string;
    price: number;
    description?: string;
    inStock: boolean;
  }

export interface CreateUserInput {
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface User extends CreateUserInput {
  id: string;
}

export interface IdParams {
  id: string;
}

export interface ProductQuery {
  search?: string;
  limit?: number;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}
