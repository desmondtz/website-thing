# ClassHub

ClassHub is a static student-portal demo built with HTML, CSS, and JavaScript. GitHub Pages can host these files, so students can open the published URL from phones without your computer running a server.

## Publish on GitHub Pages

1. Create a GitHub repository and upload the website files to its root: `index.html`, `index.htm`, `auth.js`, `login.css`, `qwe.html`, `qwe.css`, and `asd.js`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and `/(root)`, then save.
4. Share the URL GitHub Pages displays. It will look like `https://your-name.github.io/repository-name/` and works from phones anywhere with internet access.

## Demo accounts

- Stephen: ID `12-3456`, section `BSCS-1D`, password `1234`
- Zhieck: ID `26-1234`, section `BSIS-1D`, password `1234`

Account details are in `auth.js`. This static demo has no server-side authentication: anyone can inspect the public JavaScript, read the demo passwords, or bypass the sign-in screen. Use it only for a class demonstration with non-sensitive content. A real private portal with shared protected accounts needs a hosted backend and database; GitHub Pages alone cannot provide those.
