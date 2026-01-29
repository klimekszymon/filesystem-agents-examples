/**
 * File type detection and filtering.
 */

import path from 'node:path';

/** Map of type aliases to extensions */
const TYPE_MAP = {
  ts: ['.ts', '.tsx', '.mts', '.cts'],
  js: ['.js', '.jsx', '.mjs', '.cjs'],
  py: ['.py', '.pyw', '.pyi'],
  rs: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  cs: ['.cs'],
  rb: ['.rb'],
  php: ['.php'],
  swift: ['.swift'],
  kt: ['.kt', '.kts'],
  scala: ['.scala'],
  r: ['.r', '.R'],
  lua: ['.lua'],
  perl: ['.pl', '.pm'],
  sh: ['.sh', '.bash', '.zsh'],
  md: ['.md', '.markdown', '.mdx'],
  html: ['.html', '.htm'],
  css: ['.css'],
  scss: ['.scss', '.sass'],
  less: ['.less'],
  json: ['.json', '.jsonc'],
  yaml: ['.yaml', '.yml'],
  xml: ['.xml'],
  toml: ['.toml'],
  ini: ['.ini', '.cfg'],
  config: ['.config', '.conf', '.cfg', '.ini', '.env'],
  docker: ['Dockerfile', '.dockerignore', 'docker-compose.yml', 'docker-compose.yaml'],
  doc: ['.md', '.markdown', '.txt', '.rst', '.adoc'],
  text: ['.txt', '.text'],
  test: ['.test.ts', '.test.js', '.spec.ts', '.spec.js', '_test.go', '_test.py'],
};

/** Set of text file extensions */
const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.mdx', '.txt', '.text', '.rst', '.adoc',
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw', '.pyi', '.rs', '.go', '.java',
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx',
  '.cs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala',
  '.r', '.R', '.lua', '.pl', '.pm', '.sh', '.bash', '.zsh',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.json', '.jsonc', '.yaml', '.yml', '.xml', '.toml', '.ini', '.cfg', '.env',
  '.gitignore', '.ignore', '.editorconfig', '.sql', '.graphql', '.gql',
]);

/**
 * Check if a file is a text file based on extension.
 */
export function isTextFile(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const basename = path.basename(filepath);

  if (TEXT_EXTENSIONS.has(ext)) return true;

  if (['Makefile', 'Dockerfile', 'Jenkinsfile', 'Vagrantfile', 'LICENSE', 'README', 'CHANGELOG'].includes(basename)) {
    return true;
  }

  if (basename.startsWith('.') && !ext) {
    return true;
  }

  return false;
}

/**
 * Get extensions for a type alias.
 */
export function getExtensionsForType(type) {
  return TYPE_MAP[type.toLowerCase()];
}

/**
 * Check if a file matches a type filter.
 */
export function matchesType(filepath, types) {
  for (const type of types) {
    const extensions = getExtensionsForType(type);
    if (extensions) {
      if (extensions.some((e) => filepath.endsWith(e))) {
        return true;
      }
    } else {
      if (filepath.endsWith(type) || filepath.endsWith(`.${type}`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a path matches a glob pattern.
 */
export function matchesGlob(filepath, pattern) {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regex}$`).test(filepath);
}

/**
 * Check if a path should be excluded.
 */
export function shouldExclude(filepath, excludePatterns) {
  for (const pattern of excludePatterns) {
    if (matchesGlob(filepath, pattern)) {
      return true;
    }
  }
  return false;
}
