/**
 * 🦉 TypeOwl Type Extraction (TypeChecker-based)
 * 
 * Uses TypeScript's TypeChecker API to extract types from source files.
 * Types are extracted as raw TypeScript strings - no intermediate format.
 */

import ts from 'typescript';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync, readdirSync, existsSync } from 'node:fs';
import type { RawTypeDefinition } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// 🔍 TYPE EXTRACTOR INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtractedType {
  name: string;
  /** The raw TypeScript source for this type */
  source: RawTypeDefinition;
  /** Whether this type was explicitly requested or auto-discovered as a dependency */
  isDependency?: boolean;
}

export interface ExtractOptions {
  file: string;
  types?: string[];
  tsconfig?: string;
  includeDependencies?: boolean;
}

export interface RouteTypeInfo {
  method: string;
  path: string;
  params?: string;
  body?: string;
  query?: string;
  response: string;
  types: Map<string, ExtractedType>;
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

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ TYPESCRIPT PROGRAM CREATION
// ═══════════════════════════════════════════════════════════════════════════

function createProgram(files: string[], tsconfig?: string): ts.Program {
  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    declaration: true,
  };

  if (tsconfig && existsSync(tsconfig)) {
    const configFile = ts.readConfigFile(tsconfig, ts.sys.readFile);
    if (!configFile.error) {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        dirname(tsconfig)
      );
      compilerOptions = { ...compilerOptions, ...parsed.options };
    }
  }

  return ts.createProgram(files, compilerOptions);
}

function getFilesRecursively(dirPath: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getFilesRecursively(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📦 STATIC TYPE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract types from TypeScript source files as raw .d.ts content
 */
export function extractTypes(options: ExtractOptions): ExtractedType[] {
  const { file, types: typeNames, tsconfig, includeDependencies = true } = options;

  // Resolve file path
  let filePath: string;
  if (file.startsWith('file://')) {
    filePath = fileURLToPath(file);
  } else if (file.startsWith('/')) {
    filePath = file;
  } else {
    filePath = resolve(process.cwd(), file);
  }

  // Get list of files to process
  let files: string[];
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      files = getFilesRecursively(filePath);
    } else {
      files = [filePath];
    }
  } catch (e) {
    throw new Error(`[TypeOwl] Failed to read path: ${filePath}\n${e}`);
  }

  if (files.length === 0) {
    return [];
  }

  // Create TypeScript program
  const program = createProgram(files, tsconfig);
  const checker = program.getTypeChecker();

  // Track extracted types
  const extractedMap = new Map<string, ExtractedType>();
  const processing = new Set<string>();

  /**
   * Extract a type by name - get raw TypeScript source
   * Collects ALL occurrences (even duplicates) for conflict detection later
   */
  function extractTypeByName(name: string, isDependency: boolean = false): void {
    if (processing.has(name)) return;
    if (BUILTIN_TYPES.has(name)) return;

    processing.add(name);

    // Search all source files for the type
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      ts.forEachChild(sourceFile, (node) => {
        // Handle interface declarations
        if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
          const source = node.getText();
          const key = extractedMap.has(name) ? `${name}__dup__${sourceFile.fileName}` : name;
          extractedMap.set(key, {
            name,  // Keep original name for conflict detection
            source,
            isDependency,
          });

          if (includeDependencies) {
            extractDependenciesFromNode(node);
          }
        }

        // Handle type alias declarations
        if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
          const source = node.getText();
          const key = extractedMap.has(name) ? `${name}__dup__${sourceFile.fileName}` : name;
          extractedMap.set(key, {
            name,  // Keep original name for conflict detection
            source,
            isDependency,
          });

          if (includeDependencies) {
            extractDependenciesFromNode(node);
          }
        }

        // Handle enum declarations
        if (ts.isEnumDeclaration(node) && node.name.text === name) {
          // Convert enum to union type for .d.ts
          const members = node.members.map(m => {
            const initializer = m.initializer ? m.initializer.getText() : `'${m.name.getText()}'`;
            return initializer;
          });
          
          extractedMap.set(name, {
            name,
            source: `type ${name} = ${members.join(' | ')};`,
            isDependency,
          });
        }
      });
    }

    processing.delete(name);
  }

  /**
   * Extract dependencies from a node by finding type references
   */
  function extractDependenciesFromNode(node: ts.Node): void {
    function visit(child: ts.Node) {
      if (ts.isTypeReferenceNode(child)) {
        const typeName = child.typeName;
        if (ts.isIdentifier(typeName)) {
          const name = typeName.text;
          if (!BUILTIN_TYPES.has(name)) {
            extractTypeByName(name, true);
          }
        }
      }
      ts.forEachChild(child, visit);
    }
    ts.forEachChild(node, visit);
  }

  // Extract requested types or all exported types
  if (typeNames && typeNames.length > 0) {
    for (const typeName of typeNames) {
      extractTypeByName(typeName, false);
    }
  } else {
    // Extract all exported types
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      if (!files.includes(sourceFile.fileName)) continue;

      ts.forEachChild(sourceFile, (node) => {
        const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
        const isExported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

        if (isExported) {
          if (ts.isInterfaceDeclaration(node)) {
            extractTypeByName(node.name.text, false);
          }
          if (ts.isTypeAliasDeclaration(node)) {
            extractTypeByName(node.name.text, false);
          }
          if (ts.isEnumDeclaration(node)) {
            extractTypeByName(node.name.text, false);
          }
        }
      });
    }
  }

  return Array.from(extractedMap.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔵 ROUTE TYPE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract route definitions and their types from a source file
 */
export function extractRouteTypes(sourceFile: string, tsconfig?: string): RouteTypeInfo[] {
  const filePath = sourceFile.startsWith('/') 
    ? sourceFile 
    : resolve(process.cwd(), sourceFile);

  const program = createProgram([filePath], tsconfig);
  const checker = program.getTypeChecker();
  const routes: RouteTypeInfo[] = [];

  const source = program.getSourceFile(filePath);
  if (!source) return routes;

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const routeInfo = parseRouteChain(node, checker);
      if (routeInfo) {
        routes.push(routeInfo);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return routes;
}

/**
 * Get the type name as defined by the developer.
 * No expansion - keeps original names like IdParams, User, Blog.
 */
function getTypeName(type: ts.Type, checker: ts.TypeChecker): string {
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
}

/**
 * Extract the type definition source for a type (if it's a local type).
 * Returns the interface/type definition string, or null if it's a built-in.
 */
function extractTypeDefinition(type: ts.Type, checker: ts.TypeChecker): { name: string; source: string } | null {
  const symbol = type.getSymbol();
  if (!symbol) return null;
  
  const name = symbol.getName();
  if (BUILTIN_TYPES.has(name)) return null;
  
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return null;
  
  const decl = declarations[0];
  if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
    return { name, source: decl.getText() };
  }
  
  return null;
}

function parseRouteChain(node: ts.CallExpression, checker: ts.TypeChecker): RouteTypeInfo | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  
  const methodName = node.expression.name.text;
  if (methodName !== 'returns') return null;

  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length === 0) return null;

  const responseType = checker.getTypeFromTypeNode(typeArgs[0]);
  const responseTypeString = getTypeName(responseType, checker);
  
  // Collect type definitions for types used in routes
  const types = new Map<string, ExtractedType>();
  
  function collectType(type: ts.Type) {
    const def = extractTypeDefinition(type, checker);
    if (def && !types.has(def.name)) {
      types.set(def.name, { name: def.name, source: def.source });
    }
    // Also collect from union types
    if (type.isUnion()) {
      type.types.forEach(collectType);
    }
    // And array element types
    if (checker.isArrayType(type)) {
      const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
      typeArgs.forEach(collectType);
    }
  }
  
  collectType(responseType);

  let method = 'GET';
  let path = '/';
  let paramsType: string | undefined;
  let bodyType: string | undefined;
  let queryType: string | undefined;

  let current: ts.Node = node.expression.expression;

  while (ts.isCallExpression(current)) {
    if (ts.isPropertyAccessExpression(current.expression)) {
      const name = current.expression.name.text;

      if (name === 'params' && current.typeArguments?.[0]) {
        const type = checker.getTypeFromTypeNode(current.typeArguments[0]);
        paramsType = getTypeName(type, checker);
        collectType(type);
      }

      if (name === 'body' && current.typeArguments?.[0]) {
        const type = checker.getTypeFromTypeNode(current.typeArguments[0]);
        bodyType = getTypeName(type, checker);
        collectType(type);
      }

      if (name === 'query' && current.typeArguments?.[0]) {
        const type = checker.getTypeFromTypeNode(current.typeArguments[0]);
        queryType = getTypeName(type, checker);
        collectType(type);
      }

      if (['get', 'post', 'put', 'patch', 'del'].includes(name)) {
        method = name === 'del' ? 'DELETE' : name.toUpperCase();
        
        if (current.arguments.length > 0 && ts.isStringLiteral(current.arguments[0])) {
          path = current.arguments[0].text;
        }
      }

      current = current.expression.expression;
    } else {
      break;
    }
  }

  return {
    method,
    path,
    params: paramsType,
    body: bodyType,
    query: queryType,
    response: responseTypeString,
    types,  // Collected type definitions from routes
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 📤 CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export function extractFromFile(importMetaUrl: string, typeNames: string[]): ExtractedType[] {
  return extractTypes({ file: importMetaUrl, types: typeNames });
}

export type ExtractedTypes<T extends string> = {
  [K in T]: RawTypeDefinition;
};

export function extractTypesAsRecord<T extends string>(
  options: ExtractOptions & { types: T[] }
): ExtractedTypes<T> {
  const extracted = extractTypes(options);
  const result: Record<string, RawTypeDefinition> = {};

  for (const type of extracted) {
    result[type.name] = type.source;
  }

  return result as ExtractedTypes<T>;
}
