import fs from 'node:fs/promises';
import path from 'node:path';
import * as xml2js from 'xml2js';

export async function createResetDeploy() {
  const rootPath = await tryGetRootPath(process.cwd());
  const defaultXml = `<deploy></deploy>`;
  await fs.writeFile(path.join(rootPath, 'deploy.xml'), defaultXml);
  console.log('Reset deploy.xml.');
}

async function tryGetRootPath(filePath: string): Promise<string> {
  if (filePath === '/' || '') {
    console.error('Could not find root directory. Does "project.json" exist in the project?');
  }

  const files = await fs.readdir(filePath)
  if (files.includes('project.json')) {
    return filePath;
  } else {
    return tryGetRootPath(path.dirname(filePath));
  }
}

export async function addFileToDeploy(filePath: string) {
  const rootPath = await tryGetRootPath(process.cwd());
  const deployPath = path.join(rootPath, 'deploy.xml');

  let currentFile = (await fs.lstat(filePath)).isDirectory() ? `${filePath}${path.sep}*` : filePath;

  const isFileInFileCabinet = currentFile.includes(path.join(rootPath, '/FileCabinet/SuiteScripts'));
  let isJavaScript = isFileInFileCabinet && currentFile.includes('.js');
  const isTypeScript = currentFile.includes('.ts');
  const isObject = currentFile.includes(path.join(rootPath, '/Objects')) && currentFile.includes('.xml');
  let matchedJavaScriptFile: string = '';

  if (!isFileInFileCabinet && !isJavaScript && !isObject) {
    if (isTypeScript) {
      const matchedJavaScriptFiles: string[] = [];
      const currentFileName = path.basename(currentFile);

      const getFiles = async (dir: string): Promise<string[]> => {
        const subdirs = (await fs.readdir(dir));
        const f = await Promise.all(
          subdirs.map(async (subdir) => {
            const res = path.resolve(dir, subdir);
            return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
          })
        );
        return Array.prototype.concat.apply([], f);
      };

      const files: string[] = await getFiles(path.join(rootPath, '/FileCabinet/SuiteScripts'));
      for (const file of files) {
        const fileName = path.basename(file);
        if (fileName.replace(/\.[^/.]+$/, '') === currentFileName.replace(/\.[^/.]+$/, '')) {
          matchedJavaScriptFiles.push(file);
        }
      }

      if (matchedJavaScriptFiles.length) {
        isJavaScript = true;
        const currentFileParentDir = path.basename(path.dirname(currentFile));
        for (const file of matchedJavaScriptFiles) {
          const fileParentDir = path.basename(path.dirname(file));
          if (fileParentDir === currentFileParentDir) {
            matchedJavaScriptFile = file;
            break;
          }
        }
        if (!matchedJavaScriptFile && matchedJavaScriptFiles.length === 1) {
          matchedJavaScriptFile = matchedJavaScriptFiles[0];
        }
        if (matchedJavaScriptFile) {
          currentFile = matchedJavaScriptFile;
        } else {
          console.error('No matching compiled JavaScript file found in FileCabinet/SuiteScripts/**.')
          return;
        }
      } else {
        console.error('No matching compiled JavaScript file found in FileCabinet/SuiteScripts/**.');
        return;
      }
    } else {
      console.error('Invalid file to add to deploy.xml. File is not a Script or an Object.');
      return;
    }
  }

  const xmlPathKey = isFileInFileCabinet || isJavaScript ? 'files' : 'objects';
  const relativePath = currentFile.replace(rootPath, '~').replace(/\\/gi, '/');

  const deployXmlExists = await fileExists(deployPath);
  if (!deployXmlExists) {
    createResetDeploy();
  }
  const deployXml = await fs.readFile(deployPath);
  const deployJs: DeployXML = await xml2js.parseStringPromise(deployXml);
  if (typeof deployJs.deploy === 'string') {
    deployJs.deploy = {};
  }
  const elements = deployJs.deploy[xmlPathKey]?.[0].path ?? [];
  if (elements.includes(relativePath)) {
    console.error(`${isObject ? 'Object' : 'File'} already exists in deploy.xml.`);
  } else {
    elements.push(relativePath);
    if (!deployJs.deploy[xmlPathKey]) {
      deployJs.deploy[xmlPathKey] = [{ path: [] }];
    }
    deployJs.deploy[xmlPathKey]![0].path = elements;

    const newXml = new xml2js.Builder({ headless: true }).buildObject(deployJs);
    await fs.writeFile(deployPath, newXml);
    console.error(
      `Added ${matchedJavaScriptFile ? 'matching compiled JavaScript' : ''} ${isObject ? 'object' : 'file'
      } to deploy.xml.`
    );
  }
}

type DeployXML = {
  deploy: string | {
    files?: [{ path: string[] }];
    objects?: [{ path: string[] }];
  }
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
