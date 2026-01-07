/**
 * 🦉 TypeOwl Type Extraction
 * 
 * Extracts TypeScript types and interfaces directly from source files.
 * This enables zero-duplication type sharing.
 */

import { Project, SourceFile, TypeAliasDeclaration, InterfaceDeclaration, SyntaxKind } from 'ts-morph';
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
}

export interface ExtractOptions {
  /**
   * Path to the TypeScript source file
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
}

/**
 * Extract types and interfaces from a TypeScript source file
 * 
 * @example
 * // Extract specific types
 * const types = await extractTypes({
 *   file: './src/types.ts',
 *   types: ['User', 'Post', 'Comment']
 * });
 * 
 * @example
 * // Extract all exported types from current file
 * const types = await extractTypes({
 *   file: import.meta.url
 * });
 * 
 * @example
 * // Extract from absolute path
 * const types = await extractTypes({
 *   file: '/path/to/types.ts',
 *   types: ['Blog', 'Product']
 * });
 */
export function extractTypes(options: ExtractOptions): ExtractedType[] {
  const { file, types: typeNames, tsconfig } = options;
  
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
  
  // Create a ts-morph project
  const project = new Project({
    tsConfigFilePath: tsconfig,
    skipAddingFilesFromTsConfig: true,
  });
  
  // Collect source files - handle both files and directories
  const sourceFiles: SourceFile[] = [];
  
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      // Scan directory for .ts files (non-recursive for now)
      const files = readdirSync(filePath)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .map(f => join(filePath, f));
      
      for (const f of files) {
        sourceFiles.push(project.addSourceFileAtPath(f));
      }
    } else {
      sourceFiles.push(project.addSourceFileAtPath(filePath));
    }
  } catch (e) {
    throw new Error(`[TypeOwl] Failed to read path: ${filePath}\n${e}`);
  }
  
  // Extract types from all source files
  const extracted: ExtractedType[] = [];
  
  for (const sourceFile of sourceFiles) {
    // Get type aliases
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      if (typeNames && !typeNames.includes(name)) continue;
      if (!typeNames && !typeAlias.isExported()) continue;
      
      extracted.push({
        name,
        definition: extractTypeAliasDefinition(typeAlias),
        source: getTypeAliasSource(typeAlias),
      });
    }
    
    // Get interfaces
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const name = iface.getName();
      if (typeNames && !typeNames.includes(name)) continue;
      if (!typeNames && !iface.isExported()) continue;
      
      extracted.push({
        name,
        definition: extractInterfaceDefinition(iface),
        source: getInterfaceSource(iface),
      });
    }
  }
  
  return extracted;
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
// 🔄 TYPE CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extractTypeAliasDefinition(typeAlias: TypeAliasDeclaration): TypeDefinition {
  const typeNode = typeAlias.getTypeNode();
  if (!typeNode) {
    return { kind: 'primitive', value: 'unknown' };
  }
  
  // Get the raw TypeScript text for the type
  const typeText = typeNode.getText();
  return { kind: 'raw', typescript: typeText };
}

function extractInterfaceDefinition(iface: InterfaceDeclaration): TypeDefinition {
  // Get the full interface body as raw TypeScript
  const properties = iface.getProperties();
  const propsText = properties.map(prop => {
    const name = prop.getName();
    const questionToken = prop.hasQuestionToken() ? '?' : '';
    const typeNode = prop.getTypeNode();
    const typeText = typeNode ? typeNode.getText() : 'unknown';
    return `  ${name}${questionToken}: ${typeText};`;
  }).join('\n');
  
  return { kind: 'raw', typescript: `{\n${propsText}\n}` };
}

function getTypeAliasSource(typeAlias: TypeAliasDeclaration): string {
  const name = typeAlias.getName();
  const typeNode = typeAlias.getTypeNode();
  const typeText = typeNode ? typeNode.getText() : 'unknown';
  return `type ${name} = ${typeText};`;
}

function getInterfaceSource(iface: InterfaceDeclaration): string {
  return iface.getText();
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

