# Installation

* Download the apache tika jar from [Apache Tika](https://tika.apache.org/download.html)
* Download the npm package using `npm i -g summarisation/summarise`
* Setup up the config file `summarise.yaml` in the directory you want to run the tool
* Run the tool using `summarise summary` or `summarise report`

```bash
# Download the jar from [Apache Tika](https://tika.apache.org/download.html)
# Make a note of where it is: you need to reference it in the summarise.yaml file
npm i -g summarisation/summarise
summarise --version # should print the version .. verifying the installation was correct
summarise --help # should print the help

summarise summary # turns the documents => json => html => text => then summarises using generative ai and gives a report
summarise report # gives a report on the summaries 
```

# What it does

Using the information in `summarise.yaml` it will:

* Read the documents in the `pdfs` directory
* Using [Apache Tika](https://tika.apache.org/) it will extract the text from the documents
    * Note that since it is using apache tika it should handle many different types of documents. We use it with pdfs
* Todo currently we mess this up a bit... we turn the json => html => text... but we need to merge the steps to handle
  multiple pages
* The html is turned into plain text
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

* Bit hard to set up
  * Need to setup the `summarise.yaml` file
  * Need to download the apache tika jar
  * Really we should have an init command to do this
* only works on one page documents
    * Known issue and will be fixed soon by merging the html => text step
* doesn't work behind a corporate proxy
    * this is because the openai api is called directly. This is a known issue and will be fixed soon

# Configuration

```yaml
directories:
  inputs: knowledgearticles/inputs
  tika: knowledgearticles/tika
  html: knowledgearticles/html
  text: knowledgearticles/text
  summary: knowledgearticles/summary
```

This example is for knowledge articles. You can use your own values.

* The inputs are where you should store your documents. You can store them in subdirectories if you want, and this is
  preserved in the other directories
* tika is where the data extracted from the documents by Apache Tika is stored
* html is where the html is stored... this will be deleted soon
* text is where the plain text is stored
* summary is where the summaries are stored

```yaml
tika:
  type: jar
  jar: tika-app-2.9.2.jar
```

This is how the application uses Apache Tika. At the moment
you need to down load a jar from [Apache Tika](https://tika.apache.org/download.html) and put it
at the location specified in the `jar` field

```yaml
ai:
  type: openai
  url: https://api.openai.com
  model: gpt-3.5-turbo
  token: OPENAI_TOKEN
```

This is the configuration of the generative ai. At the moment only openai is supported.
You need to get an api key from openai and put it in the environment variable specified in the `token` field

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

```yaml

schema: # The json returned has to match this schema
  type: inline
  value: true
```

Currently not used. We should! This is to validate the json returned by the generative ai.
because of the retry logic it would retry until the number of retries is exhausted, or it is compliant
This is useful because I have noticed that only occasionally the ai returns a json that is not compliant with the schema

```yaml
prompt: |
  I want you to evaluate a Knowledge Article for an ITSM issue using the following four areas

  description: Do we have a clear description of what the issue is that this KEDB is about? Red/Orange/Green
  detection: Do we have a clear technical mechanism to determine that the issue exists. For example sql calls, api calls and so on
  and if we do, do we have enough information. For example with sql we need database connection details. For apis we need the urls
  resolution: Do we have a clear technical mechanism to resolve the issue. Same example issues (ie. sql needs conneciton issues)
  validation: Do we have a clear technical mechanism to validate that we have resolved the issue

  Note that traffic light colours are Red, Amber, Green

  The results will be used in RAG, so please provide a json object  with the name of the section (the description, detection, resolution and validation)
  each section is an object having two fields called 'value' and 'summary'. The first is  a  traffic light value, and the second a summary of why that value was chosen.
  In addition create a final object called 'summary' with the same two fields which score the whole based on the traffic light values, and give a summary about the quality of the KEDB entry.

  The knowledge article is
  {knowledgeArticle}
```

I think this is pretty obvious: it's the prompt engineering. Note the {knowledgeArticle} at the end. This is replaced by
the text of the document

Also note that is pretty nice if you want to customise it: you don't need code, just change the prompt. Have fun playing

```yaml
report:
  categories: [ "description", "detection", "resolution", "validation", "summary" ]
  fields:
    value:
      type: enum
      enum: [ "Red", "Amber", "Green" ]
```

So this is the report for the example in the prompt.

* categories: the categories that are in the prompt
* fields: the report fields. Here we only have one 'value'. If we change the prompt we might have a different enum or
  even a number
    * the type can be `enum` or `number`. If a number we don't need the enum field

The point of this is that

* if you change the categories in the prompt you can change the report without changing the code
* If you change from traffic lights to a number or 'good'/'bad' or 'compliant'/'non-compliant' you can change the report
  without changing the code

