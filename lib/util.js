import { RDFResource } from './config';

export function checkNotEmpty(argument, message = 'This cannont be empty!') {
  if (!argument) {
    throw Error(message);
  }
  if (argument instanceof RDFResource) {
    if (argument.attributes.size === 0) {
      throw Error(message);
    }
  } else if (argument instanceof Map) {
    if (argument.size == 0) {
      throw Error(message);
    }
  } else if (!argument?.length) {
    throw Error(message);
  }
}
