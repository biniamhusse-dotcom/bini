# Node/Express Mediator Application

This is a README file for a Node.js and Express emr-eapts mediator application. This application acts as a mediator between emr system and eapts (dagu) system, facilitating communication and data exchange. The mediator pattern helps decouple systems by introducing an intermediary component that handles interactions between them.

## Table of Contents
- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Endpoints](#endpoints)

## Introduction
The Node/Express EMR-Eapts Mediator Application is built using Node.js and Express, two popular JavaScript frameworks. It provides an HTTP-based API for handling requests and forwarding them to the appropriate services. The mediator pattern allows you to easily add, remove, or modify services without impacting the clients.

## Installation
To install and run the mediator application locally, follow these steps:

1. Clone the repository:  
   ```
   git clone https://mekdi_md@bitbucket.org/jsi-bahmni/emr-eapts.git
   ```
2. Navigate to the project directory:  
   ```
   cd emr-eAPTs
   ```
3. Install the dependencies:  
   ```
   npm install
   ```
4. Start the application:  
   ```
   node index.js
   node drugSync.js
   node drugDispense.js
   node dtpCase.js
   node addressSync.js
   ```

The application should now be running on `http://localhost: <3001,3005, 3006, 3007, 3008, 3009>`.

## Usage
Once the mediator application is up and running, you can interact with it using OpenHIM. OpenHIM can send requests (trigger) to the mediator, and it will forward those requests to the appropriate services based on predefined rules. The mediator then collects the responses from the services and returns a combined response to the client.

## Configuration
The mediator application can be configured by modifying the `config/config.js` file. This file contains the configuration options for the mediator, such as service endpoints, request mappings, and response aggregation rules send to the mediator upon registration. Customize these configurations according to your specific requirements.

## Endpoints
The mediator application exposes the following endpoints:

/fetch: Forwards the prescription information to the eaptsService in the services/index module and returns the response.
/dtpCase: Forwards the dtpCase request from eapts to emr in the services/dtpCase module and returns the response.
/drugSync: Forwards the drugSync request from eapts to emr in the services/drugSync module and returns the response.
/drugDispense: Forwards the dispense request in the services/drugDispense module and returns the response.
/addressSync: Forwards the address request to the addressService in the services/addressSync module and returns the response.


Note: The actual endpoints and their mappings may vary based on your specific configuration.
