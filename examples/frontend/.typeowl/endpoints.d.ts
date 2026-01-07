/**
 * 🦉 TypeOwl Generated Types
 * Domain: endpoints
 * Version: 1.0.0
 * Generated: 2026-01-07T13:54:50.617Z
 * DO NOT EDIT - This file is auto-generated
 */

export type GetApiUsersResponse = ({ id: string; email: string; name: string; role: 'admin' | 'user' | 'guest' })[];

export interface GetApiUsersByIdParams {
  id: string;
}

export interface GetApiUsersByIdResponse {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
}

export interface PostApiUsersBody {
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface PostApiUsersResponse {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
}

export interface DeleteApiUsersByIdParams {
  id: string;
}

export interface DeleteApiUsersByIdResponse {
  success: boolean;
  message: string;
}

export interface GetApiProductsByIdParams {
  id: string;
}
