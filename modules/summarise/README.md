# Summarise

This takes a whole load of documents, extracts the text from them, summarises the text and then gives a report on the
summaries.

* Uses Apache Tika to extract the text from the documents, so works with many files formats including pdfs, docx, xlsx,
  pptx, and many more
* Uses Openai to summarise the text
* Produces aggregated reports on the summaries

# Getting started

## Installation

* Download the jar from [Apache Tika](https://tika.apache.org/download.html)
    * Make a note of where it is: you need to reference it in the summarise.yaml file
* Make sure you have an openai token in an environment variable.
    * If you use OPENAI_TOKEN you don't need to change the summarise.yaml file

```bash
npm i -g summarisation/summarise
summarise init # creates a summarise.yaml file in the current directory. 
```
Don't forget to update the summarise.yaml file with the location of the tika jar, and optionally the openai token
environment variable name

## Checking the installation

```yaml
summarise --version # should print the version .. verifying the installation was correct. Only works if there is a summary.yaml file 
summarise --help # should print the help

summarise validate # checks the directories exist, the apache tika jar exists and connectivity with openai 
```

## Using the summarise command

```yaml
summarise summary # turns the documents => json => html => text => then summarises using generative ai and gives a report
summarise report # gives a report on the summaries

  # The following commands are for debugging - they do each stage one at a time
summarise tika # extracts the text from the documents
summarise text # summarises the text
summarise ai # summarises the text using the generative ai 
```

# How it works 

Using the information in `summarise.yaml` it will:

* Read the documents in the `pdfs` directory
* Using [Apache Tika](https://tika.apache.org/) it will extract the text from the documents into html
    * Note that since it is using apache tika it should handle many different types of documents. We use it with pdfs
* The html is turned into plain text using the cheerio library
* The text is summarised using generative ai
* The summaries are written to the `summaries` directory

At each stage we store the result as a file, so you can debug things easily and see where things are going wrong

* inputs => Apache Tika => `tika` directory
* tika => extract text => `text` directory
* text => summarise => `summary` directory

Also note that the sha of the text is stored in the summary directory and if it hasn't changed the document is not
resummarised.
This has a dramatic effect on the time and cost of large numbers of documents

# Known issues

* doesn't work behind a corporate proxy
    * this is because the openai api is called directly. This is a known issue and will be fixed soon
* Sends the whole text of the whole document...so only works on small documents because of token limits
    * I am not sure what to do about this... we can summarise pages of the documents easily... but is that meaningful?
    * For the primary use case this is for, the current behavior is acceptable

# Configuration

All configuration is done in the `summarise.yaml` file. This is a yaml file in the current directory (or a parent directory).
It has the following sections

## Directories
```yaml
directories:
  inputs: knowledgearticles/inputs
  tika: knowledgearticles/tika
  text: knowledgearticles/text
  summary: knowledgearticles/summary
```

This example is for knowledge articles. You can use your own values.

* The inputs are where you should store your documents. You can store them in subdirectories if you want, and this is
  preserved in the other directories
* tika is where the data extracted from the documents by Apache Tika is stored
* text is where the plain text is stored
  * Note that if apache tika splits the document into multiple files then the text is stored in multiple files
  * The file name is the original filename but the extension is .xxx.txt where xxx is a number representing where the data came from in the original document
* summary is where the summaries are stored

## Tika jar configuration
```yaml
tika:
  type: jar
  jar: tika-app-2.9.2.jar
```

This is how the application uses Apache Tika. At the moment
you need to download a jar from [Apache Tika](https://tika.apache.org/download.html) and put it
at the location specified in the `jar` field

## AI configuration
```yaml
ai:
  type: openai
  url: https://api.openai.com
  model: gpt-3.5-turbo
  token: OPENAI_TOKEN
```

This is the configuration of the generative ai. At the moment only openai is supported.
You need to get an api key from openai and put it in the environment variable specified in the `token` field

## Non functional configuration
```yaml
nonfunctionals:
  throttlingPerHour: 1000 # 1000 requests per hour
  concurrent: 100 # No more than 100 concurrent requests
  retry:
    initialInterval: 5000
    maximumInterval: 20000
    maximumAttempts: 10
    nonRecoverableErrors:
      - Not Found
```

These non functionals are used to interact with open ai. They are critical if you have thousands of documents.

* Throttling: how many calls an hour allowed
    * Note that if we get 429 codes then we will back off and retry and reduce the throttling
* concurrent: the maximum number of calls at anyone moment to open ai.
* retry: how to retry if we get errors
    * initialInterval: the time to wait before retrying
    * maximumInterval: the maximum time to wait before retrying
    * maximumAttempts: the maximum number of retries
    * nonRecoverableErrors: the errors that we should not retry on

## Schema configuration

```yaml
schema: # The json returned has to match this schema
  type: inline
  value: true
```

Currently not used. We should! This will (in the future) validate the json returned by the generative ai.
because of the retry logic it would retry until the number of retries is exhausted, or it is compliant
This is useful because I have noticed that only occasionally the ai returns a json that is not compliant with the schema

## Prompt configuration
```yaml
prompt: |
  I want you to evaluate a Knowledge Article for an ITSM issue using the following four areas

   description: Do we have a clear description of what the issue is that this KEDB is about? To be good it should describe the symptoms, the cause and the impact
   detection: Do we have a clear technical mechanism to determine that the issue exists. For example sql calls, api calls and so on
   and if we do, do we have enough information. For example with sql we need database connection details. For apis we need the urls
   resolution: Do we have a clear technical mechanism to resolve the issue. Same example issues (ie. sql needs conneciton issues)
   validation: Do we have a clear technical mechanism to validate that we have resolved the issue

   Note that traffic light colours are Red, Amber, Green

   The results will be used in RAG, so please provide a json object  with the name of the section (the description, detection, resolution and validation)
   each section is an object having two fields called 'value' and 'summary'. The first is  a  traffic light value, and the second a summary of why that value was chosen.
   In addition create a final object called 'summary' with the same two fields which score the whole based on the traffic light values, and give a summary about the quality of the KEDB entry.

   Please do not repeat the description in the summary: we want just a json object with the four sections and the summary

   The knowledge article is
   {text}
```

I think this is pretty obvious: it's the prompt engineering. Note the {text} at the end. This is replaced by
the text of the document

Also note that is pretty nice if you want to customise it: you don't need code, just change the prompt. Have fun playing

## Report configuration
```yaml
report:
  categories: [ "description", "detection", "resolution", "validation", "summary" ]
  fields:
    value:
      type: enum
      enum: [ "Red", "Amber", "Green" ]
```

This is the report for the example in the prompt.

* categories: the categories that are in the prompt
* fields: the report fields. Here we only have one 'value'. If we change the prompt we might have a different enum or
  even a number
    * the type can be `enum` or `number`. If a number we don't need the enum field

The point of this is that

* if you change the categories in the prompt you can change the report without changing the code
* If you change from traffic lights to a number or 'good'/'bad' or 'compliant'/'non-compliant' you can change the report
  without changing the code

# Troubleshooting

* If you run the command `summarise <anything>`it should validate the `summarise.yaml` file has all needed values and is
  formatted correctly. If
  it doesn't please raise a bug about this
* If you run the command `summarise validate` it should
    * check the directories exist (only the input directory is required to run summarise)
    * the apache tika jar exists
    * connectivity with openai.
* There are debug commands for each stage
    * `summarise tika` extracts the text from the documents
    * `summarise text` summarises the text
    * `summarise ai` summarises the text using the generative ai
    * Each of these commands has a `--debug` option which will print out the command that is run
    * They also have a `--dry-run` option which will print out the command that is run but not run it

Note that if you are behind a corporate proxy at the moment this might not work

* We are using axios. See the axios documentation for the usage of environment variables 
  * [Read this](https://axios-http.com/docs/req_config). The relevant section is `httpAgent` and `httpsAgent` and their documentation
  * This is untested
* You can set the env variable NODE_TLS_REJECT_UNAUTHORIZED to the value 0
    * This exposes you to man in the middle attacks and is unsafe. Please do not go to production with this
    * Please read https://hayageek.com/disable-ssl-verification-in-node-js/ for more information
      Fixing this is on the backlog

If you have a problem please raise an issue. I am happy to help  
