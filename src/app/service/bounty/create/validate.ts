import { CommandContext } from 'slash-create';
import constants from '../../../constants';
import mongo, { Db, UpdateWriteOpResult } from 'mongodb';
import BountyUtils from '../../../utils/BountyUtils';
import ServiceUtils from '../../../utils/ServiceUtils';
import { GuildMember } from 'discord.js';
import dbInstance from '../../../utils/db';

export default async (ctx: CommandContext): Promise<any> => {
	if (ctx.user.bot) return;

	const bountyId = ctx.options.create.validate['bounty-id'];
	const { guildMember } = await ServiceUtils.getGuildAndMember(ctx);

	await BountyUtils.validateBountyId(ctx, guildMember, bountyId);
	return finalizeBounty(ctx, guildMember, bountyId);
};

export const finalizeBounty = async (ctx: CommandContext, guildMember: GuildMember, bountyId: string): Promise<any> => {
	console.log('starting to finalize bounty: ' + bountyId);

	const db: Db = await dbInstance.dbConnect(constants.DB_NAME_BOUNTY_BOARD);
	const dbCollection = db.collection(constants.DB_COLLECTION_BOUNTIES);
	const dbBountyResult = await dbCollection.findOne({
		_id: new mongo.ObjectId(bountyId),
		status: 'Draft',
	});

	if (dbBountyResult == null) {
		console.log(`${bountyId} bounty not found in db`);
		await ctx.send(`${ctx.user.mention} Sent you a DM with information.`);
		return guildMember.send(`<@${ctx.user.id}> Sorry we're not able to find the drafted bounty.`);
	}

	if (dbBountyResult.status != 'Draft') {
		console.log(`${bountyId} bounty is not drafted`);
		return ctx.send(`<@${ctx.user.id}> Sorry bounty is not drafted.`);
	}

	const currentDate = (new Date()).toISOString();
	const writeResult: UpdateWriteOpResult = await dbCollection.updateOne(dbBountyResult, {
		$set: {
			createdBy: {
				discordHandle: ctx.user.username,
				discordId: ctx.user.id,
			},
			status: 'Open',
		},
		$push: {
			statusHistory: {
				status: 'Open',
				setAt: currentDate,
			},
		},
	});

	if (writeResult.modifiedCount != 1) {
		console.log(`failed to update record ${bountyId} for user <@${ctx.user.id}>`);
		return ctx.send(`<@${ctx.user.id}> Sorry something is not working, our devs are looking into it.`);
	}

	await dbInstance.close();
	return ctx.send(`<@${ctx.user.id}> Bounty published to #🧀-bounty-board and on the website! ${constants.BOUNTY_BOARD_URL}/${bountyId}`);
};
