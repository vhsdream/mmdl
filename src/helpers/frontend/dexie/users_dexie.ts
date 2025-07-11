import { isValidResultArray } from "@/helpers/general";
import { Users, db } from "./dexieDB";
import { getUserDataFromCookies, logoutUser } from "../user";
import { nextAuthEnabled } from "@/helpers/thirdparty/nextAuth";
import { getSessionFromNextAuthAPI, getUserIDFromNextAuthSession_API } from "../nextAuthHelpers";

export async function getUserIDFromHash_Dexie(userhash){
    // console.log("url, username", url, username)

    if(!userhash) return 
    //First we check if the data is even there.
    const userIDArray =  await db.users
    .where('hash')
    .equals(userhash)
    .toArray()
    .catch(e =>{
        console.error("getUserIDFromHash_Dexie", e)
    })
    if(userIDArray && isValidResultArray(userIDArray)){
        // console.log("userIDArray",userIDArray)
        
        return userIDArray[userIDArray.length-1]["id"]
        
    }else{
        return null
    }

}


export async function deDuplicateUser(userIDArray: Users[])
{
    //Count number of Caldav_Accounts for each user id.
    let counter = [] 
    for(const i in userIDArray){


    }
    
}
export async function getUserIDForCurrentUser_Dexie(){
    if(!await nextAuthEnabled()){

        const userData = getUserDataFromCookies()
        const userHash = userData["userhash"]
        const userid = await getUserIDFromHash_Dexie(userHash)    
        return userid
    }else{
        //NextAuth is being used.
        const userhash = await getUserIDFromNextAuthSession_API()

        return await getUserIDFromHash_Dexie(userhash)    

    }
}

async function getUserHashforCurrentUser(){
    if(!await nextAuthEnabled()){

        const userData = getUserDataFromCookies()
        return userData["userhash"]
        
    }else{
        //NextAuth is being used.
        return await getUserIDFromNextAuthSession_API()
    }

}

export async function addUserToDB_Dexie(userhash){
    
    const id = await db.users.add({
        hash:userhash,      
    })
  


}

export async function checkifCurrentUserInDexie(){

    // const userData = getUserDataFromCookies()
    // const userhash = userData["userhash"]

    // if(!userhash){
    //     return false
    // }
    const userid = await getUserIDForCurrentUser_Dexie()
    if(!userid){

        const userhash = await getUserHashforCurrentUser()
        console.log("userid and hash", userid, userhash)
    
        await addUserToDB_Dexie(userhash)
        
    }

    return true

}