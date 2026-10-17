# tldraw PDF Editor

### Background
I wanted a way to annotate PDFs that had a better UX than MacOS Preview, but couldn't find any satisfactory alternatives. 

Then, I remembered tldraw. I love tldraw. It's the best canvas drawing tool I've seen. I use it to teach, brainstorm, and organize thoughts. tldraw doesn't support PDF imports on their webapp but they do provide a [PDF editor example](https://tldraw.dev/examples/pdf-editor)! I just took their code and put some scaffolding around it so I can run it locally.

### How to run

1. Download/clone this repo.
2. Install dependencies:

   ```
   npm install
   ```

3. Run server:

   ```
   npm run dev
   ```

4. Go to http://localhost:1646/ and open a PDF to edit.
5. Button to export your PDF? Top right of your screen.
   
### Notes

- Only annotations within PDF page limits will be exported.
- Reload the page to choose a different PDF.