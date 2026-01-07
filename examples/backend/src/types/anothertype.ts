type Developer = {
  id: string;
  name: string;
  email: string;
  role: DeveloperRole;
};
enum DeveloperRole {
    ADMIN = 'admin',
    USER = 'user',
    GUEST = 'guest',
}
type customeType<T extends string | number> = `custom_${T}`;
type Author = {
    isDeveloper: boolean;
    developers: Map<string, Developer>;
    customType: customeType<string>;
};
type NoUsageType = {
    id: string;
    noUsage: boolean;
};
export type { Author , NoUsageType};