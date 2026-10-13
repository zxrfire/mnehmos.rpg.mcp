/** A fixture key follows actual TypeScript dependencies, including side-effect and lazy imports. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function fixtureDependencies(root: string, entries: readonly string[]): string[] {
    const seen = new Set<string>();
    const pending = entries.map(entry => path.resolve(root, entry));
    const resolve = (file: string, specifier: string): void => {
        if (!specifier.startsWith('.')) return;
        const target = path.resolve(path.dirname(file), specifier);
        const candidates = /\.js$/.test(target) ? [target.slice(0, -3) + '.ts', target]
            : path.extname(target) ? [target] : [target + '.ts', path.join(target, 'index.ts')];
        const found = candidates.find(candidate => fs.existsSync(candidate));
        if (!found) throw new Error(`Fixture dependency missing: ${specifier} from ${file}`);
        pending.push(found);
    };
    while (pending.length) {
        const file = pending.pop()!;
        if (seen.has(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        seen.add(file);
        if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
        const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node): void => {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
                && ts.isStringLiteral(node.moduleSpecifier)) resolve(file, node.moduleSpecifier.text);
            if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
                && ts.isStringLiteral(node.argument.literal)) resolve(file, node.argument.literal.text);
            if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
                && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
                resolve(file, node.moduleReference.expression.text);
            }
            if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
                || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
                const argument = node.arguments[0];
                if (!argument || !ts.isStringLiteralLike(argument)) {
                    throw new Error(`Fixture dependency must be explicit: ${file}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}`);
                }
                resolve(file, argument.text);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return [...seen].sort();
}

/** Runtime, loader configuration and dependencies can change a walk without changing its engine. */
export function hashFixtureSources(root: string, entries: readonly string[]): string {
    const files = fixtureDependencies(root, entries);
    for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts']) {
        const file = path.join(root, name);
        if (fs.existsSync(file) && !files.includes(file)) files.push(file);
    }
    const hash = createHash('sha256').update(`fixture-v2:${process.platform}:${process.arch}:${process.version}`);
    for (const file of files.sort()) {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        const bytes = fs.readFileSync(file);
        hash.update(`${relative.length}:${relative}:${bytes.length}:`).update(bytes);
    }
    return hash.digest('hex');
}
