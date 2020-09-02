import { NextApiRequest, NextApiResponse } from 'next';
import jsforce from 'jsforce';

const CONSTANTS = {
      SALESFORCE_EMAIL: process.env.SALESFORCE_EMAIL,
      SALESFORCE_PASSWORD: process.env.SALESFORCE_PASSWORD,
      SALESFORCE_SECURITY_TOKEN: process.env.SALESFORCE_SECURITY_TOKEN,
      LEMLIST_API_KEY: process.env.LEMLIST_API_KEY,
      SALESFORCE_TASK_SUBJECT: 'Lemlist Email',
      SALESFORCE_LEMLISTTASK_ID: '0123k0000014TCyAAM',
      SALESFORCE_STATUS: 'Completed',
      SALESFORCE_TASK_SUBTYPE: 'Task',
      SALESFORCE_SOBJECT_TYPE: 'Task',
      LEMLIST_CAMPAIGN_FETCH_COOLDOWN_TIME_IN_MS: 30000,
};

let salesforceConnection;
let lastCampaignCheckedTimestamp: number;
let cachedCampaignsArray: Array<LemlistCampaign> = [];

export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
      const {
            method,
      } = req;

      if (method !== "POST") {
            res.status(405).json({ error: "Method Not Allowed" });
            return;
      }

      if(!salesforceConnection?.accessToken) {
            console.info("Attempting to log in!");
            salesforceConnection = new jsforce.Connection();
            try {
                  await salesforceConnection.login(CONSTANTS.SALESFORCE_EMAIL, CONSTANTS.SALESFORCE_PASSWORD + CONSTANTS.SALESFORCE_SECURITY_TOKEN);
                  console.info("Successfully logged in!");
            } catch (err) {
                  salesforceConnection = null;
                  res.status(500).json({ error: err } );
                  return console.error(err);
            }
      }
      const lemlistPayload = req.body;
      try {
            const sobjectQueryResponse = await salesforceConnection.sobject(CONSTANTS.SALESFORCE_SOBJECT_TYPE).create({
                  TaskSubtype: CONSTANTS.SALESFORCE_TASK_SUBTYPE,
                  Subject: CONSTANTS.SALESFORCE_TASK_SUBJECT,
                  Status: CONSTANTS.SALESFORCE_STATUS,
                  RecordTypeId: CONSTANTS.SALESFORCE_LEMLISTTASK_ID,
                  ActivityDate: new Date(), //DueDate
                  Lemlist_Campaign_Name__c: await getLemlistCampaignNameFromCampaignId(lemlistPayload.campaignId),
                  Lemlist_Sender__c: lemlistPayload.sendUserName,
                  Lemlist_Email__c: lemlistPayload.leadEmail,
                  Lemlist_Task_Type__c: lemlistPayload.type,
                  Lemlist_Sequence_Step_Number__c: lemlistPayload.sequenceStep,
            }, {});
            if(!sobjectQueryResponse.success) {
                  console.error(sobjectQueryResponse);
            } else {
                  console.info('Task created successfully: ', sobjectQueryResponse);
            }
      } catch (err) {
            return console.error(err);
      }
      res.status(200).json({ response: "200 OK" });
}

interface LemlistCampaign {
      _id: string,
      name: string,
      archived: boolean
}

const getLemlistCampaigns = async (): Promise<Array<LemlistCampaign>> => {
      const endpoint = "https://:" + CONSTANTS.LEMLIST_API_KEY + "@api.lemlist.com/api/campaigns";
      console.info("Attempting to fetch Lemlist Campaigns from API");
      const response: Response = await fetch(endpoint);
      return await response.json() as Array<LemlistCampaign>;
}

const getLemlistCampaignNameFromCampaignId = async (campaignId: string): Promise<string> => {
      let campaign: string = filterCampaignById(cachedCampaignsArray, campaignId);
      if(!campaign) {
            //we keep track of how long ago we last pulled from Lemlist so we don't end up getting rate limited if there's an ID we can't find
            let now: number = Date.now();
            if(!lastCampaignCheckedTimestamp || now - lastCampaignCheckedTimestamp > CONSTANTS.LEMLIST_CAMPAIGN_FETCH_COOLDOWN_TIME_IN_MS) {
                  cachedCampaignsArray = await getLemlistCampaigns();
                  campaign = filterCampaignById(cachedCampaignsArray, campaignId);
                  lastCampaignCheckedTimestamp = now;
            }
      }
      return campaign;
}

const filterCampaignById = (campaigns: Array<LemlistCampaign>, campaignId: string): string  => {
      for (let campaign of campaigns) {
            if (campaign._id === campaignId) {
                  return campaign.name;
            }
      }
      return null;
}