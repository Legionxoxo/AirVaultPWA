import { UserRole } from '@/data/allowedRoles';
import { MAIN_URL } from '@/data/env';
import sqlAsync from '@/database/sqlAsync';
import tableNames from '@/database/tableNames';
import axiosPost from '@/functions/axios/axiosPost';
import { authOptions } from '@/lib/authOptions';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(request: NextRequest) {
	let success = false,
		msg = '';
	try {
		const userSession = await getServerSession(authOptions);
		const userObj = userSession?.user,
			email = userObj?.email;

		if (!userObj || !email) {
			msg = 'Please login to continue!';
			throw new Error(msg);
		}

		// -> Get the role of the logged in user <-
		const sqlRes1 = await sqlAsync.getAsync(`SELECT * FROM ${tableNames.users} WHERE email = ?`, email);
		if (!sqlRes1) {
			msg = 'Logged in user not found!';
			throw new Error(msg);
		}

		const user_role = sqlRes1?.role || '';

		// make sure that only the admin or mod can edit user data
		if (user_role !== UserRole.OWNER && user_role !== UserRole.ADMIN && user_role !== UserRole.MODERATOR) {
			msg = "You don't have permission to grant directory access to group!";
			throw new Error(msg);
		}

		// get the request body
		const requestJson = await request.json();
		const path = z.string().min(1).parse(requestJson.path);
		const group = z.string().min(1).parse(requestJson.group);
		const permission = z.string().min(1).parse(requestJson.permission);

		// grant the access to the groups
		const axiosRes = await axiosPost(`${MAIN_URL}/api/acl/permissions/set_group_perm`, {
			path,
			group,
			permission: permission,
		});

		if (axiosRes && axiosRes?.status === 200 && axiosRes?.data?.success) {
			success = true;
			msg = 'Successfully granted access to groups!';
		} else {
			msg = 'Failed to grant access to groups!';
		}
	} catch (error) {
		console.error(`An error has occurred while granting access to group! Error: `, error);
		msg = msg || 'An error has occurred while granting access to group!';
	} finally {
		return NextResponse.json({ success, msg });
	}
}