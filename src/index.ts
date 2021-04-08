import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { JsonObject, normalize } from '@angular-devkit/core';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as sharp from 'sharp';
import { Schema } from './schema';

// These are our input options defined
// for type safety
type InputOptions = Schema & JsonObject;

// function that will be executed by the builder
async function execute(
  options: InputOptions,
  context: BuilderContext,
): Promise<BuilderOutput> {
  context.logger.warn('Starting optimizations');

  /**
   * Lookup the provided folder with the extensions
   * The default values from the schema.json will be added if none is provided:
   *  - folder will be: './src/assets/
   *  - extensions will be: 'png,jpg,jpeg'
   */
  const lookupPattern = normalize(
    `./${options.folder}**/*.{${options.extensions}}`,
  );

  // lookup the files based on the lookupPattern
  const matches = glob.sync(lookupPattern);

  context.logger.info(`We found ${matches.length} matche(s)`);

  // let's count all optimized images
  let optimizedImages = 0;
  try {
    await Promise.all(
      // go through all matches
      matches.map(async (fileName) => {
        const fileStream = sharp(fileName);
        context.logger.debug(`[DEBUG]: match found ${fileName}`);

        // Get the metadata from the fileStream
        const metadata = await fileStream.metadata();

        // when the width is smaller or equal to the max_width don't do anything
        if (metadata && metadata.width && metadata.width <= options.max_width) {
          return;
        }

        // provide a temp name for the optimized picture
        const optimizedName = fileName.replace(
          /(\..+)$/,
          (_match, ext) => `-optimized${ext}`,
        );

        // transform the image based on the options
        await fileStream
          .resize(options.max_width)
          .jpeg({ quality: options.quality })
          .toFile(`${optimizedName}`);

        // add one to our counter
        ++optimizedImages;

        context.logger.debug(`[DEBUG]: Renaming to: ${optimizedName}`);

        // swap the optimized file with the original
        return await fs.rename(optimizedName, fileName);
      }),
    );

    context.logger.warn(`Finished optimizations for ${optimizedImages} images`);
  } catch (error) {
    context.logger.error('Error when trying to imagization');
    context.logger.error(error);
    return { success: false, error: `We couldn't run the optimization` };
  }

  return { success: true };
}

// Add the default createBuilder function
export default createBuilder(execute);
