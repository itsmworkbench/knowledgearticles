This is a mono repo for code related to 'summarising documents' using Generative AI

There is a command line tool described [here](modules/summarise/README.md) that can be used to summarise document.
It handles throttling, concurrency control, backpressure, and retries.

The tool is configured using yaml. In this you can control the non functionals, the location of files, the prompt for
the generative ai.

At the moment only openai is supported, but that is expected to change.

Usage:
* Put your documents (pdfs, txt, docx,...) in a directory
* Setup a CI/CD pipeline to run the tool
* The tool will read the documents, summarise them, and write the summaries to a directory
* Note that it will only summarise documents that have changed
  * This is controlled by the sha of the text form of the document. If the sha is the same, the document is not resummarised
* There is a simple report tool that summarises the summaries. This is useful for giving aggregate statistics on the summaries 
