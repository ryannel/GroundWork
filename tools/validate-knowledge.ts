import { validateKnowledgeFiles } from './knowledge-validation';
import { validationOptions } from './knowledge-validation-args';

const result = await validateKnowledgeFiles(validationOptions(process.argv.slice(2)));
console.log(JSON.stringify(result, null, 2));
