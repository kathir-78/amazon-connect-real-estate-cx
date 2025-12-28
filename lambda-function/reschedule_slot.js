import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  PutItemCommand,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";


function to24Hour(time12) {
  const [time, modifier] = time12.trim().split(" ");
  let [h, m] = time.split(":").map(Number);

  if (modifier === "PM" && h !== 12) h += 12;
  if (modifier === "AM" && h === 12) h = 0;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function getISTDate() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}


export const handler = async (event) => {

  const client = new DynamoDBClient({ region: "us-east-1" });

  try {
    const { selectedDay, selectedTime } =
      event.Details.ContactData.Attributes;

    const phoneNumber =
      event.Details.ContactData.CustomerEndpoint.Address;

    if (!selectedTime || !phoneNumber) {
      return { status: "INVALID_INPUT" };
    }

    // 1️ Fetch existing booking
    const bookingResult = await client.send(
      new QueryCommand({
        TableName: "kn_slot_booked",
        KeyConditionExpression: "phoneNumber = :p",
        ExpressionAttributeValues: {
          ":p": { S: phoneNumber }
        },
        Limit: 1,
        ScanIndexForward: false
      })
    );

    if (!bookingResult.Items || bookingResult.Items.length === 0) {
      return { status: "NO_EXISTING_BOOKING" };
    }

    const booking = bookingResult.Items[0];

    const oldSlotDate = booking.slotDate.S;
    const oldSlotTime = booking.slotTime.S;

    // 2️ Calculate NEW slot
    const date = getISTDate();

    if (selectedDay === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }

    const newSlotDate = formatDate(date);
    const newSlotTime24 = to24Hour(selectedTime);

    // 3️ Lock NEW slot
    await client.send(
      new UpdateItemCommand({
        TableName: "kn_available_slots",
        Key: {
          slotDate: { S: newSlotDate },
          slotTime: { S: newSlotTime24 }
        },
        UpdateExpression: "SET isAvailable = :false",
        ConditionExpression: "isAvailable = :true",
        ExpressionAttributeValues: {
          ":true": { BOOL: true },
          ":false": { BOOL: false }
        }
      })
    );

    // 4️ Free OLD slot
    await client.send(
      new UpdateItemCommand({
        TableName: "kn_available_slots",
        Key: {
          slotDate: { S: oldSlotDate },
          slotTime: { S: oldSlotTime }
        },
        UpdateExpression: "SET isAvailable = :true",
        ExpressionAttributeValues: {
          ":true": { BOOL: true }
        }
      })
    );

    // 5 DELETE old booking record
    await client.send(
      new DeleteItemCommand({
        TableName: "kn_slot_booked",
        Key: {
          phoneNumber: { S: phoneNumber },
          slotDate: { S: oldSlotDate }
        }
      })
    );

    //6️ INSERT new booking record
    await client.send(
      new PutItemCommand({
        TableName: "kn_slot_booked",
        Item: {
          phoneNumber: { S: phoneNumber },
          slotDate: { S: newSlotDate },
          slotTime: { S: newSlotTime24 },
          status: { S: "RESCHEDULED" },
        }
      })
    );

    return {
      status: "SUCCESS",
      slotDate: newSlotDate,
      slotTime: selectedTime
    };

  } catch (error) {
    console.error("RESCHEDULE ERROR:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return { status: "SLOT_ALREADY_BOOKED" };
    }

    return {
      status: "FAILED",
      message: error.message
    };
  }
};
