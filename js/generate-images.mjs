import {
  applyPaperStyles,
  removePaperStyles,
  renderOutput
} from './utils/generate-utils.mjs';
import { createPDF } from './utils/helpers.mjs';

const pageEl = document.querySelector('.page-a');
let outputImages = [];

/**
 * To generate image, we add styles to DIV and convert that HTML Element into an Image.
 */
async function convertDIVToImage() {
  const options = {
    scrollX: 0,
    scrollY: -window.scrollY,
    scale: document.querySelector('#resolution').value,
    useCORS: true
  };

  /** The html2canvas library (included in index.html) converts the HTML element to a canvas. */
  const canvas = await html2canvas(pageEl, options);

  // Apply scanner effect if selected
  if (document.querySelector('#page-effects').value === 'scanner') {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    contrastImage(imageData, 0.55);
    context.putImageData(imageData, 0, 0);
  }

  outputImages.push(canvas);
  // Update header with the number of generated images
  document.querySelector('#output-header').textContent =
    'Output ( ' + outputImages.length + ' )';
}

/**
 * Greedy Algorithm for Pagination:
 *
 * This helper function implements a greedy strategy to paginate text content.
 * It splits the original content into tokens (words and whitespace) and
 * iteratively builds up a page by appending tokens until the container's
 * height exceeds the designated clientHeight. Once the height is exceeded,
 * it finalizes the current page (by removing the last token that caused the overflow)
 * and starts a new page. This approach is simple, efficient, and adheres to the
 * Single Responsibility Principle by isolating pagination from image generation.
 *
 * @param {string} content - The full text content to be paginated.
 * @param {HTMLElement} container - The DOM element used to measure text height.
 * @param {number} clientHeight - The maximum allowed height for each page.
 * @returns {string[]} An array of strings, each representing the content for one page.
 */
function paginateContent(content, container, clientHeight) {
  const tokens = content.split(/(\s+)/); // split content while keeping spaces
  const pages = [];
  let currentPageTokens = [];
  let index = 0;

  while (index < tokens.length) {
    // Try adding the next token and check if it fits
    currentPageTokens.push(tokens[index]);
    container.innerHTML = currentPageTokens.join('');
    if (container.scrollHeight > clientHeight) {
      // The last token caused overflow. Remove it and finalize the current page.
      currentPageTokens.pop();
      pages.push(currentPageTokens.join(''));
      // Reset the current page tokens; note: do not lose the token that caused overflow
      currentPageTokens = [];
      // Do not increment index so that the token is retried for the next page.
    } else {
      index++;
    }
  }
  // Add any remaining tokens as the final page.
  if (currentPageTokens.length > 0) {
    pages.push(currentPageTokens.join(''));
  }
  return pages;
}

/**
 * This function is called when the "Generate Image" button is clicked.
 */
export async function generateImages() {
  applyPaperStyles();
  pageEl.scroll(0, 0);

  const paperContentEl = document.querySelector('.page-a .paper-content');
  const scrollHeight = paperContentEl.scrollHeight;
  const clientHeight = 514; // fixed height for .paper-content when empty

  // If content requires multiple pages, use the greedy pagination algorithm.
  if (scrollHeight > clientHeight) {
    // Warning if images are already present
    if (paperContentEl.innerHTML.includes('<img')) {
      alert(
        "You're trying to generate more than one page, Images and some formatting may not work correctly with multiple images"
      );
    }
    const initialPaperContent = paperContentEl.innerHTML;
    // Use the helper function to split content into pages.
    const pages = paginateContent(initialPaperContent, paperContentEl, clientHeight);

    // Iterate through each page, generate an image, and then restore the full content.
    for (const pageText of pages) {
      paperContentEl.innerHTML = pageText;
      pageEl.scrollTo(0, 0);
      await convertDIVToImage();
      paperContentEl.innerHTML = initialPaperContent;
    }
  } else {
    // Single page scenario
    await convertDIVToImage();
  }

  removePaperStyles();
  renderOutput(outputImages);
  setRemoveImageListeners();
}

/**
 * Deletes all generated images.
 */
export const deleteAll = () => {
  outputImages.splice(0, outputImages.length);
  renderOutput(outputImages);
  document.querySelector('#output-header').textContent =
    'Output' + (outputImages.length ? ' ( ' + outputImages.length + ' )' : '');
};

/**
 * Moves an element within an array from oldIndex to newIndex.
 * Time Complexity: O(n) in the worst-case due to the use of splice.
 */
const arrayMove = (arr, oldIndex, newIndex) => {
  if (newIndex >= arr.length) {
    let k = newIndex - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr; // returns the modified array
};

export const moveLeft = (index) => {
  if (index === 0) return outputImages;
  outputImages = arrayMove(outputImages, index, index - 1);
  renderOutput(outputImages);
};

export const moveRight = (index) => {
  if (index + 1 === outputImages.length) return outputImages;
  outputImages = arrayMove(outputImages, index, index + 1);
  renderOutput(outputImages);
};

/**
 * Downloads generated images as a PDF.
 */
export const downloadAsPDF = () => createPDF(outputImages);

/**
 * Sets event listeners for close and move buttons on output images.
 */
function setRemoveImageListeners() {
  document
    .querySelectorAll('.output-image-container > .close-button')
    .forEach((closeButton) => {
      closeButton.addEventListener('click', (e) => {
        outputImages.splice(Number(e.target.dataset.index), 1);
        document.querySelector('#output-header').textContent =
          'Output' + (outputImages.length ? ' ( ' + outputImages.length + ' )' : '');
        renderOutput(outputImages);
        // Re-attach listeners after output changes.
        setRemoveImageListeners();
      });
    });

  document.querySelectorAll('.move-left').forEach((leftButton) => {
    leftButton.addEventListener('click', (e) => {
      moveLeft(Number(e.target.dataset.index));
      renderOutput(outputImages);
      setRemoveImageListeners();
    });
  });

  document.querySelectorAll('.move-right').forEach((rightButton) => {
    rightButton.addEventListener('click', (e) => {
      moveRight(Number(e.target.dataset.index));
      renderOutput(outputImages);
      setRemoveImageListeners();
    });
  });
}

/**
 * Modifies image data to add contrast.
 */
function contrastImage(imageData, contrast) {
  const data = imageData.data;
  contrast *= 255;
  const factor = (contrast + 255) / (255.01 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
  return imageData;
}
