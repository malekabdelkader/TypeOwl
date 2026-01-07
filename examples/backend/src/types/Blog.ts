import { Author } from "./anothertype.js";

export type Blog = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  author?: Author;
}
export type  BlogInput = Pick<Blog, 'title' | 'content'>;