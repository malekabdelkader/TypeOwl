/**
 * 🦉 TypeOwl Type Extraction
 * 
 * Extracts TypeScript types and interfaces directly from source files.
 * Automatically follows and includes dependent/nested types.
 * This enables zero-duplication type sharing.
 */

import { Project, SourceFile, TypeAliasDeclaration, InterfaceDeclaration, EnumDeclaration, Node, SyntaxKind, Type } from 'ts-morph';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync, readdirSync } from 'node:fs';
import type { TypeDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🔍 TYPE EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtractedType {
  name: string;
  definition: TypeDefinition;
  /** The raw TypeScript source for this type */
  source: string;
  /** Whether this type was explicitly requested or auto-discovered as a dependency */
  isDependency?: boolean;
}

export interface ExtractOptions {
  /**
   * Path to the TypeScript source file or directory
   * Can be:
   * - Absolute path: '/Users/.../src/types.ts'
   * - Relative path: './types.ts' (relative to cwd)
   * - import.meta.url: Pass the current file's URL
   */
  file: string;
  
  /**
   * Names of types/interfaces to extract
   * If not provided, extracts ALL exported types and interfaces
   */
  types?: string[];
  
  /**
   * Path to tsconfig.json (optional)
   * If not provided, uses default TypeScript settings
   */
  tsconfig?: string;
  
  /**
   * Whether to automatically include dependent types
   * @default true
   */
  includeDependencies?: boolean;
}

// Built-in types that should not be extracted
const BUILTIN_TYPES = new Set([
  'string', 'number', 'boolean', 'null', 'undefined', 'void', 'never', 'any', 'unknown',
  'object', 'symbol', 'bigint', 'Function', 'Object', 'String', 'Number', 'Boolean',
  'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Date', 'RegExp', 'Error',
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'Parameters', 'ConstructorParameters', 'ReturnType', 'InstanceType',
  'ThisType', 'Uppercase', 'Lowercase', 'Capitalize', 'Uncapitalize',
]);

/**
 * Extract types and interfaces from a TypeScript source file
 * Automatically follows and includes dependent types.
 * 
 * @example
 * // Extract specific types (will auto-include dependencies)
 * const types = extractTypes({
 *   file: './src/types.ts',
 *   types: ['Blog', 'Product']
 * });
 * 
 * @example
 * // Extract all exported types from a directory
 * const types = extractTypes({
 *   file: './src/types/'
 * });
 */
export function extractTypes(options: ExtractOptions): ExtractedType[] {
  const { file, types: typeNames, tsconfig, includeDependencies = true } = options;
  
  // Resolve the file path
  let filePath: string;
  if (file.startsWith('file://')) {
    const currentFile = fileURLToPath(file);
    filePath = currentFile;
  } else if (file.startsWith('/')) {
    filePath = file;
  } else {
    filePath = resolve(process.cwd(), file);
  }
  
  // Create a ts-morph project with resolution enabled
  const project = new Project({
    tsConfigFilePath: tsconfig,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      // Enable module resolution to follow imports
      moduleResolution: 100, // NodeNext
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    },
  });
  
  // Collect source files - handle both files and directories
  const sourceFiles: SourceFile[] = [];
  const baseDir = statSync(filePath).isDirectory() ? filePath : dirname(filePath);
  
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      // Scan directory for .ts files recursively
      addFilesRecursively(filePath, project, sourceFiles);
    } else {
      sourceFiles.push(project.addSourceFileAtPath(filePath));
    }
  } catch (e) {
    throw new Error(`[TypeOwl] Failed to read path: ${filePath}\n${e}`);
  }
  
  // Track extracted types to avoid duplicates
  const extractedMap = new Map<string, ExtractedType>();
  // Track types being processed to detect cycles
  const processing = new Set<string>();
  
  /**
   * Extract a single type and its dependencies
   */
  function extractTypeByName(
    name: string, 
    isDependency: boolean = false
  ): void {
    // Skip if already extracted or processing
    if (extractedMap.has(name) || processing.has(name)) return;
    // Skip built-in types
    if (BUILTIN_TYPES.has(name)) return;
    
    processing.add(name);
    
    // Find the type declaration across all source files
    for (const sourceFile of project.getSourceFiles()) {
      // Check type aliases
      const typeAlias = sourceFile.getTypeAlias(name);
      if (typeAlias) {
        const extracted = extractTypeAlias(typeAlias, isDependency);
        extractedMap.set(name, extracted);
        
        // Extract dependencies if enabled
        if (includeDependencies) {
          const deps = findTypeDependencies(typeAlias);
          for (const dep of deps) {
            extractTypeByName(dep, true);
          }
        }
        processing.delete(name);
        return;
      }
      
      // Check interfaces
      const iface = sourceFile.getInterface(name);
      if (iface) {
        const extracted = extractInterface(iface, isDependency);
        extractedMap.set(name, extracted);
        
        // Extract dependencies if enabled
        if (includeDependencies) {
          const deps = findTypeDependencies(iface);
          for (const dep of deps) {
            extractTypeByName(dep, true);
          }
        }
        processing.delete(name);
        return;
      }
      
      // Check enums
      const enumDecl = sourceFile.getEnum(name);
      if (enumDecl) {
        const extracted = extractEnum(enumDecl, isDependency);
        extractedMap.set(name, extracted);
        processing.delete(name);
        return;
      }
    }
    
    // Type not found in loaded files - try to resolve from imports
    for (const sourceFile of sourceFiles) {
      const importedFile = resolveImportedType(sourceFile, name, project);
      if (importedFile) {
        // The file was added to project, retry extraction
        processing.delete(name);
        extractTypeByName(name, isDependency);
        return;
      }
    }
    
    processing.delete(name);
  }
  
  // Extract requested types
  if (typeNames && typeNames.length > 0) {
    // Extract specific types
    for (const typeName of typeNames) {
      extractTypeByName(typeName, false);
    }
  } else {
    // Extract all exported types from the source files
    for (const sourceFile of sourceFiles) {
      // Get type aliases
      for (const typeAlias of sourceFile.getTypeAliases()) {
        if (typeAlias.isExported()) {
          extractTypeByName(typeAlias.getName(), false);
        }
      }
      
      // Get interfaces
      for (const iface of sourceFile.getInterfaces()) {
        if (iface.isExported()) {
          extractTypeByName(iface.getName(), false);
        }
      }
      
      // Get enums
      for (const enumDecl of sourceFile.getEnums()) {
        if (enumDecl.isExported()) {
          extractTypeByName(enumDecl.getName(), false);
        }
      }
    }
  }
  
  return Array.from(extractedMap.values());
}

/**
 * Recursively add .ts files from a directory
 */
function addFilesRecursively(
  dirPath: string, 
  project: Project, 
  sourceFiles: SourceFile[]
): void {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        addFilesRecursively(fullPath, project, sourceFiles);
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      sourceFiles.push(project.addSourceFileAtPath(fullPath));
    }
  }
}

/**
 * Find all type names referenced within a type declaration
 */
function findTypeDependencies(
  node: TypeAliasDeclaration | InterfaceDeclaration
): Set<string> {
  const dependencies = new Set<string>();
  
  // Find all type references in the node
  node.forEachDescendant((descendant) => {
    if (Node.isTypeReference(descendant)) {
      const typeName = descendant.getTypeName();
      if (Node.isIdentifier(typeName)) {
        const name = typeName.getText();
        if (!BUILTIN_TYPES.has(name)) {
          dependencies.add(name);
        }
      } else if (Node.isQualifiedName(typeName)) {
        // Handle qualified names like Namespace.Type
        const name = typeName.getRight().getText();
        if (!BUILTIN_TYPES.has(name)) {
          dependencies.add(name);
        }
      }
    }
  });
  
  return dependencies;
}

/**
 * Try to resolve an imported type and add its source file to the project
 */
function resolveImportedType(
  sourceFile: SourceFile, 
  typeName: string,
  project: Project
): SourceFile | null {
  // Find import that brings in this type
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const namedImports = importDecl.getNamedImports();
    const hasType = namedImports.some(ni => ni.getName() === typeName);
    
    if (hasType) {
      // Resolve the module specifier to a file path
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const sourceFilePath = sourceFile.getFilePath();
      const sourceDir = dirname(sourceFilePath);
      
      // Try to resolve the import
      let resolvedPath: string | null = null;
      
      if (moduleSpecifier.startsWith('.')) {
        // Relative import
        let targetPath = resolve(sourceDir, moduleSpecifier);
        
        // Try different extensions
        const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
        for (const ext of extensions) {
          const testPath = targetPath.replace(/\.(js|mjs)$/, '') + ext;
          try {
            if (statSync(testPath.replace(/\.js$/, '.ts')).isFile()) {
              resolvedPath = testPath.replace(/\.js$/, '.ts');
              break;
            }
          } catch {}
          try {
            if (statSync(testPath).isFile()) {
              resolvedPath = testPath;
              break;
            }
          } catch {}
        }
        
        // Try without extension replacement
        if (!resolvedPath) {
          const noExt = targetPath.replace(/\.(js|mjs|ts|tsx)$/, '');
          for (const ext of ['.ts', '.tsx']) {
            try {
              if (statSync(noExt + ext).isFile()) {
                resolvedPath = noExt + ext;
                break;
              }
            } catch {}
          }
        }
      }
      
      if (resolvedPath) {
        // Check if already in project
        const existing = project.getSourceFile(resolvedPath);
        if (existing) return existing;
        
        // Add to project
        try {
          return project.addSourceFileAtPath(resolvedPath);
        } catch {
          return null;
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract a type alias declaration
 */
function extractTypeAlias(
  typeAlias: TypeAliasDeclaration, 
  isDependency: boolean
): ExtractedType {
  const name = typeAlias.getName();
  const typeParams = typeAlias.getTypeParameters();
  const typeNode = typeAlias.getTypeNode();
  
  // Build the generic parameters text
  let genericText = '';
  if (typeParams.length > 0) {
    const params = typeParams.map(p => {
      const constraint = p.getConstraint();
      const defaultType = p.getDefault();
      let paramText = p.getName();
      if (constraint) paramText += ` extends ${constraint.getText()}`;
      if (defaultType) paramText += ` = ${defaultType.getText()}`;
      return paramText;
    }).join(', ');
    genericText = `<${params}>`;
  }
  
  const bodyText = typeNode ? typeNode.getText() : 'unknown';
  const fullTypeSource = `type ${name}${genericText} = ${bodyText};`;
  
  return {
    name,
    definition: { 
      kind: 'raw', 
      typescript: bodyText,
      generics: genericText || undefined,
    },
    source: fullTypeSource,
    isDependency,
  };
}

/**
 * Extract an interface declaration
 */
function extractInterface(
  iface: InterfaceDeclaration, 
  isDependency: boolean
): ExtractedType {
  const name = iface.getName();
  const typeParams = iface.getTypeParameters();
  const properties = iface.getProperties();
  const methods = iface.getMethods();
  const extends_ = iface.getExtends();
  
  // Build interface body
  const members: string[] = [];
  
  for (const prop of properties) {
    const propName = prop.getName();
    const questionToken = prop.hasQuestionToken() ? '?' : '';
    const typeNode = prop.getTypeNode();
    const typeText = typeNode ? typeNode.getText() : 'unknown';
    members.push(`  ${propName}${questionToken}: ${typeText};`);
  }
  
  for (const method of methods) {
    members.push(`  ${method.getText()}`);
  }
  
  const bodyText = `{\n${members.join('\n')}\n}`;
  
  // Build full interface text
  let typeParamText = '';
  if (typeParams.length > 0) {
    const params = typeParams.map(p => {
      const constraint = p.getConstraint();
      const defaultType = p.getDefault();
      let paramText = p.getName();
      if (constraint) paramText += ` extends ${constraint.getText()}`;
      if (defaultType) paramText += ` = ${defaultType.getText()}`;
      return paramText;
    }).join(', ');
    typeParamText = `<${params}>`;
  }
  
  let extendsText = '';
  if (extends_.length > 0) {
    extendsText = ` extends ${extends_.map(e => e.getText()).join(', ')}`;
  }
  
  // Combine generics and extends for the full interface header
  const headerSuffix = typeParamText + extendsText;
  
  return {
    name,
    definition: { 
      kind: 'raw', 
      typescript: `interface${headerSuffix} ${bodyText}`,
      generics: headerSuffix || undefined, // Store as marker that this is a full interface
    },
    source: `interface ${name}${typeParamText}${extendsText} ${bodyText}`,
    isDependency,
  };
}

/**
 * Extract an enum declaration
 */
function extractEnum(
  enumDecl: EnumDeclaration, 
  isDependency: boolean
): ExtractedType {
  const name = enumDecl.getName();
  const members = enumDecl.getMembers();
  
  // Build enum body
  const memberTexts = members.map(m => {
    const memberName = m.getName();
    const initializer = m.getInitializer();
    if (initializer) {
      return `  ${memberName} = ${initializer.getText()}`;
    }
    return `  ${memberName}`;
  });
  
  const bodyText = `{\n${memberTexts.join(',\n')}\n}`;
  
  // For TypeScript declaration, convert enum to union of literal types
  const values = members.map(m => {
    const initializer = m.getInitializer();
    if (initializer) {
      return initializer.getText();
    }
    // For numeric enums without initializers
    return `'${m.getName()}'`;
  });
  
  const unionType = values.join(' | ');
  
  return {
    name,
    definition: { kind: 'raw', typescript: unionType },
    source: `enum ${name} ${bodyText}`,
    isDependency,
  };
}

/**
 * Convenience function to extract from current file
 * 
 * @example
 * // In your server.ts file:
 * type Blog = { id: string; title: string; }
 * interface Product { name: string; price: number; }
 * 
 * const types = extractFromFile(import.meta.url, ['Blog', 'Product']);
 */
export function extractFromFile(importMetaUrl: string, typeNames: string[]): ExtractedType[] {
  return extractTypes({ file: importMetaUrl, types: typeNames });
}

// ═══════════════════════════════════════════════════════════════════════════
// 🗂️ BATCH EXTRACTION RESULT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result type that allows easy destructuring
 */
export type ExtractedTypes<T extends string> = {
  [K in T]: TypeDefinition;
};

/**
 * Extract types and return as a record for easy registration
 * 
 * @example
 * const { Blog, Product } = extractTypesAsRecord({
 *   file: import.meta.url,
 *   types: ['Blog', 'Product']
 * });
 * 
 * typeowl
 *   .domain('blog')
 *   .registerType('Blog', Blog)
 *   .registerType('Product', Product);
 */
export function extractTypesAsRecord<T extends string>(
  options: ExtractOptions & { types: T[] }
): ExtractedTypes<T> {
  const extracted = extractTypes(options);
  const result: Record<string, TypeDefinition> = {};
  
  for (const type of extracted) {
    result[type.name] = type.definition;
  }
  
  return result as ExtractedTypes<T>;
}
