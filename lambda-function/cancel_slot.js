import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";

function toAmPm(time24) {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function getDayName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}


export const handler = async (event) => {

  const client = new DynamoDBClient({ region: "us-east-1" });

  try {

    const phoneNumber = event?.Details?.ContactData?.CustomerEndpoint?.Address;

    if (!phoneNumber) {
      return {
        status: "FAILED",
        message: "Missing phone number"
      };
    }

    console.log("Phone number:", phoneNumber);

    const customer = await client.send(
      new GetItemCommand({
        TableName: "kn_customers",
        Key: { phoneNumber: { S: phoneNumber } }
      })
    );

    if (!customer.Item) {
      return {
        status: "FAILED",
        message: "Customer not found"
      };
    }

    console.log("Customer verified");

    const bookingResult = await client.send(
      new QueryCommand({
        TableName: "kn_slot_booked",
        KeyConditionExpression: "phoneNumber = :p",
        ExpressionAttributeValues: {
          ":p": { S: phoneNumber }
        },
        ScanIndexForward: false,
        Limit: 1
      })
    );

    if (!bookingResult.Items || bookingResult.Items.length === 0) {
      return {
        status: "FAILED",
        message: "No active booking found"
      };
    }

    const booking = bookingResult.Items[0];
    const slotDate = booking.slotDate.S;
    const slotTime = booking.slotTime.S;

    console.log(`Booking found: ${slotDate} ${slotTime}`);

    await client.send(
      new UpdateItemCommand({
        TableName: "kn_available_slots",
        Key: {
          slotDate: { S: slotDate },
          slotTime: { S: slotTime }
        },
        UpdateExpression: "SET isAvailable = :true",
        ExpressionAttributeValues: {
          ":true": { BOOL: true }
        }
      })
    );

    console.log("Slot released");

    await client.send(
      new DeleteItemCommand({
        TableName: "kn_slot_booked",
        Key: {
          phoneNumber: { S: phoneNumber },
          slotDate: { S: slotDate }
        }
      })
    );

    console.log("Booking record deleted");

    return {
      status: "SUCCESS",
      slotDate: slotDate,
      slotDay: getDayName(slotDate),
      slotTime: toAmPm(slotTime),
      phoneNumber: phoneNumber
    };

  } catch (error) {
    console.error("CANCELLATION ERROR:", error);
    return {
      status: "FAILED",
      message: error.message || "Cancellation failed"
    };
  }
};
