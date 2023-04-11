import moment from "moment"
import { dueDatetoUnixStamp, ISODatetoHuman } from "./general"
import { getAuthenticationHeadersforUser } from "./user"

export async function saveFiltertoServer(name, filter)
{
    const url_api=process.env.NEXT_PUBLIC_API_URL+"filters/add"

    const authorisationData=await getAuthenticationHeadersforUser()


    return new Promise( (resolve, reject) => {

        const requestOptions =
        {
            method: 'POST',
            body: JSON.stringify({"name":name, "filtervalue": filter}),
            mode: 'cors',
            headers: new Headers({'authorization': authorisationData, 'Content-Type':'application/json'}),
        }
        try    
        {
            fetch(url_api, requestOptions)
        .then(response => response.json())
        .then((body) =>{
            console.log(body)
            resolve(body)
           
            
        });
        }
        catch(e)
        {
            this.props.onResponse(e.message)
        }
    
    
    })

}

export async function makeFilterEditRequest(filterid, name, finalFilter)
{
    const url_api=process.env.NEXT_PUBLIC_API_URL+"filters/modify"

    const authorisationData=await getAuthenticationHeadersforUser()


    return new Promise( (resolve, reject) => {

        const requestOptions =
        {
            method: 'POST',
            body: JSON.stringify({"name":name, "filtervalue": finalFilter, "custom_filters_id": filterid}),
            mode: 'cors',
            headers: new Headers({'authorization': authorisationData, 'Content-Type':'application/json'}),
        }
        try    
        {
            fetch(url_api, requestOptions)
        .then(response => response.json())
        .then((body) =>{
            resolve(body)
           
            
        });
        }
        catch(e)
        {
            console.log(e.message)
            resolve(null)
        }
    
    
    })

}

/**
 * Checks if the filter is valid.
 * @param {*} filter A JSON filter.
 * @returns Filter, if valid. Null otherwise
 */ 
export function checkifFilterValid(filter)
{

    var hasValidDueFilter=true
    var hasValidPriorityFilter = true
    var hasValidLabelFilter = true
    var hasValidLogic = true

    if(filter.filter.due!=null && filter.filter.due!=undefined)
    {
        if((filter.filter.due[0]=="" || filter.filter.due[0]==null) &&  (filter.filter.due[1]=="" || filter.filter.due[1]==null))
        {
            hasValidDueFilter=false
        }else
        {
            if(filter.filter.due[0]!=null && filter.filter.due[0]!="" && filter.filter.due[1]!="" && filter.filter.due[1]!=null)
            {
                if(filter.filter.due[1]<filter.filter.due[0])
                {
                    hasValidDueFilter=false
                }
    
            }
        }
    }
    else
    {
        hasValidDueFilter=false
    }
  
    
    if(filter.filter.label==null || (Array.isArray(filter.filter.label) ==false && filter.filter.label!=null )  || (Array.isArray(filter.filter.label) == true && filter.filter.label!=null && filter.filter.label.length<1 ))
    {

        hasValidLabelFilter = false
    }


    if(filter.filter.priority==null || filter.filter.priority=="" )
    {
        hasValidPriorityFilter=false
    }

    if(filter.logic==null || filter.logic =="")
    {
        hasValidLogic= false
    }

    if(hasValidDueFilter || hasValidLabelFilter || hasValidLogic || hasValidPriorityFilter)
    {
        return true
    }
    else{
        return false
    }
}
export async function getFiltersFromServer()
{
    const url_api=process.env.NEXT_PUBLIC_API_URL+"filters/get"
    const authorisationData=await getAuthenticationHeadersforUser()

    const requestOptions =
    {
        method: 'GET',
        mode: 'cors',
        headers: new Headers({'authorization': authorisationData}),

    }

    return new Promise( (resolve, reject) => {
        const response =  fetch(url_api, requestOptions)
        .then(response => response.json())
        .then((body) =>{
            resolve(body)       

            }
        )
    });
  

}

export function filtertoWords(filter)
{
    var toReturnArray=[]
    var toReturnFinal = []

    if(filter.filter.due!=null&& filter.filter.due!=undefined)
    {
        var dueBefore="End of the universe"
        var dueAfter ="Beginning of the universe"
        if(filter.filter.due[0]!="" && filter.filter.due[0]!=null)
        {
        dueAfter= moment(new Date(filter.filter.due[0])).format('DD/MM/YYYY HH:mm');
        }
    
        if(filter.filter.due[1]!="" && filter.filter.due[1]!=null )
        {
            dueBefore=moment(new Date(filter.filter.due[1])).format('DD/MM/YYYY HH:mm');
        }


        toReturnArray.push(
            <>
            &#123; DUE AFTER <small>{dueAfter.toString()}</small> AND DUE BEFORE <small>{dueBefore.toString()}</small> &#125;
            </>)
   


    }



    if(filter.filter.label!=null && filter.filter.label.length>0)
    {
        var labelString = []

        for(const j in filter.filter.label)
        {
            if(j!=0)
            {
                labelString.push(" or ")
            }
            labelString.push(<i key={filter.filter.label[j]}>&nbsp;{filter.filter.label[j]}&nbsp;</i>)
           

        }
        
        toReturnArray.push(<>
        &#123; TASK HAS ANY OF THESE LABELS &#91; {labelString} &#93;  &#125;
        </>)
        
    }

    if(filter.filter.priority!="" && filter.filter.priority!=""&&filter.filter.priority!=undefined)
    {
        toReturnArray.push(<>
        &#123; TASK HAS A MINIMUM PRIORITY OF {filter.filter.priority}  &#125;

        </>)
    }
    

    for (const i in toReturnArray)
    {
        if(i!=0 )
        {
            toReturnFinal.push(<><br/><b>{filter.logic} </b><br/></>)
        }
         toReturnFinal.push(toReturnArray[i])
        
    }
   

   return toReturnFinal

}

export function applyEventFilter(event, filter)
{
    var logic="and"
    if(filter.logic!=null && filter.logic!=undefined)
    {
        logic=filter.logic.toLowerCase()
    }

    if(logic == "or")
    {
        var filterByLabelResult = false
        if(filter.filter.label!=null)
        {
            var filterByLabelResult= filterbyLabel(filter.filter.label, event.category)
            
        }
        var filterByDueResult= false
        if(filter.filter.due!=null)
        {
            filterByDueResult = filterbyDue(filter.filter.due, event.due)
           
           
        }

        var filterbyPriorityResult =false

        if(filter.filter.priority!=null)
        {
            filterbyPriorityResult=filterbyPriority(filter.filter.priority,event.priority)
            
           
        }

        if(filterbyPriorityResult == true || filterByDueResult == true || filterByLabelResult == true)
        {
            return true
        }
        else
        {
            return false
        }

    }else{

        var filterByLabelResult = null
        if(filter.filter.label!=null)
        {
            var filterByLabelResult= filterbyLabel(filter.filter.label, event.category)
            if(filterByLabelResult==false)
            {
                return false
            }
        }
        var filterByDueResult= null
        if(filter.filter.due!=null && filterbyDue(filter.filter.due, event.due)==false)
        {
            filterByDueResult = false
            return filterByDueResult
           
        }

        var filterbyPriorityResult =null

        if(filter.filter.priority!=null && filterbyPriority(filter.filter.priority,event.priority)==false)
        {
            filterbyPriorityResult=false
            
            return filterbyPriorityResult
           
        }

        return true

    }
    

}

function filterbyLabel(filterArray, categoryArray)
{
    var toReturn = false
    if(filterArray!=null && filterArray.length>0 )
    {
        if(categoryArray!=null )
        {
            for (let j=0; j<categoryArray.length; j++)
            {
                 
                for (let i=0; i<filterArray.length; i++)
                {
                    if(filterArray[i].trim()==categoryArray[j].trim())
                    {
                        return true
                    }
                    
                }
            }
        }
        else
        {
            return false
        }        
        
    }


    return toReturn
}

function filterbyDue(filterdueArray, dueDate)
{
    var toReturn = false
    if(filterdueArray!=null && filterdueArray.length==2)
    {
        if(dueDate!=null && dueDate!="")
        {
            var dueUnixStamp= dueDatetoUnixStamp(ISODatetoHuman(dueDate))
            if(dueUnixStamp>=filterdueArray[0] && dueUnixStamp <= filterdueArray[1])
            {
                return true
            }
        }
        else
        {
            return false
        }        
        
    }


    return toReturn

}

function filterbyPriority(priorityFilter, priority)
{
    var toReturn = false
    if(priorityFilter!=null)
    {
        if(priority!=null && priority<priorityFilter)
        {
                return true
           
        }
        else
        {
            return false
        }        
        
    }


    return toReturn

}
