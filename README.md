# tldraw PDF Editor

### Background

I wanted a way to annotate PDFs that had a better UX than MacOS Preview, but couldn't find any satisfactory alternatives.

Then, I remembered tldraw. I love tldraw. It's the best canvas drawing tool I've seen. I use it to teach, brainstorm, and organize thoughts. tldraw doesn't support PDF imports on their webapp but they do provide a [PDF editor example!](https://tldraw.dev/examples/pdf-editor) I took this code as a starting point, then added features such as a canvas scrollbar, saved edits, scratch pages, page previews, and more.

It's currently hosted with Vercel at https://tldraw-pdf.vercel.app but you can also run it locally:

### How to run

1. Download/clone this repo.
2. Install dependencies with [node](https://nodejs.org/en/download):

   ```
   npm install
   ```

3. Run server:

   ```
   npm run dev
   ```

4. Go to http://localhost:1646/ and open a PDF to edit.

### Notes

- Only annotations within PDF page limits will be exported. If you need more space, you can add a scratch page on either side of your pages.
- Reload the page to choose a different PDF.
- Edits are saved in an in-browser IndexedDB for continued PDF editing upon page refreshes and page unloads.
- Use my "Zoom to page" feature to fit your current page on the screen. Shortcut "⇧ 3", or open the zoom menu in the bottom left.

### About Vercel deployment

- Need `VITE_TLDRAW_LICENSE_KEY` in the Vercel project's production environment variables. The license key is only passed to tldraw in production builds; local `npm run dev` does not need it.
- Vercel Analytics and the GitHub source link are enabled in production builds and omitted from the local dev server.
