import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });

function toAmPm(time24) {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function getISTDateTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export const handler = async (event) => {
  try {
    const dayType = event.Details.ContactData.Attributes.selectedDay;

    const istNow = getISTDateTime();

    if (dayType === "tomorrow") {
      istNow.setDate(istNow.getDate() + 1);
    }

    const slotDate = formatDate(istNow);
    const currentTime = istNow.toTimeString().slice(0, 5);

    console.log("slotDate:", slotDate, "currentTime:", currentTime, "dayType:", dayType);

    const result = await client.send(
      new QueryCommand({
        TableName: "kn_available_slots",
        KeyConditionExpression: "slotDate = :d",
        FilterExpression: "isAvailable = :true",
        ExpressionAttributeValues: {
          ":d": { S: slotDate },
          ":true": { BOOL: true }
        },
        ScanIndexForward: true
      })
    );

    let slots = result.Items.map(item => {
      const data = unmarshall(item);
      return {
        time24: data.slotTime,
        display: toAmPm(data.slotTime)
      };
    });


    if (dayType === "today") {
      const nowMinutes = timeToMinutes(currentTime);
      slots = slots.filter(s => timeToMinutes(s.time24) > nowMinutes);
    }

    slots = slots.slice(0, 3);

    return {
      slotDate,
      dayType,
      slot1: slots[0]?.display || "NA",
      slot2: slots[1]?.display || "NA",
      slot3: slots[2]?.display || "NA"
    };

  } catch (err) {
    console.error(err);
    return {
      slotDate: "NA",
      slot1: "NA",
      slot2: "NA",
      slot3: "NA",
      error: err.message
    };
  }
};
