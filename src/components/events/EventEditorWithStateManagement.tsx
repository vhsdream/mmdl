import { getI18nObject } from "@/helpers/frontend/general";
import { useEffect, useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { EventEditorInputType } from "stateStore/EventEditorStore";
import { Loading } from "../common/Loading";
import { currentDateFormatAtom, currentSimpleDateFormatAtom } from "stateStore/SettingsStore";
import { useAtomValue, useSetAtom } from "jotai";
import Recurrence from "@/components/common/Recurrence";
import { getEtagFromEventID_Dexie, getEventFromDexieByID, getEventURLFromDexie, saveEventToDexie } from "@/helpers/frontend/dexie/events_dexie";
import { addAdditionalFieldsFromOldEventV2, getParsedEvent, postNewEvent, preEmptiveUpdateEvent, rruleToObject, updateEvent} from "@/helpers/frontend/events";
import { Datepicker } from "@/components/common/Datepicker/Datepicker"
import { RruleObject } from "types/recurrence";
import { RRuleHelper } from "@/helpers/frontend/classes/RRuleHelper";
import { AlarmForm, AlarmType } from "./AlarmForm";
import { toast } from "react-toastify";
import moment from "moment";
import { CalendarPicker } from "../common/Calendarpicker";
import {  getDefaultCalendarIDFromLocalStorage } from "@/helpers/frontend/cookies";
import { getObjectForAPICallV2, makeGenerateICSRequest } from "@/helpers/frontend/ics";
import { getRandomString } from "@/helpers/crypto";
import { getCalDAVAccountIDFromCalendarID_Dexie, getCalendarbyIDFromDexie, isValidCalendarsID } from "@/helpers/frontend/dexie/calendars_dexie";
import { getAPIURL, varNotEmpty } from "@/helpers/general";
import { getMessageFromAPIResponse } from "@/helpers/frontend/response";
import { parseVALARMTIME } from "@/helpers/frontend/rfc5545";
import { getAuthenticationHeadersforUser } from "@/helpers/frontend/user";
import { RecurrenceHelper } from "@/helpers/frontend/classes/RecurrenceHelper";
import { PRIMARY_COLOUR } from "@/config/style";
import { moveEventModalInput, showMoveEventModal } from "stateStore/MoveEventStore";

const i18next = getI18nObject()

export const EventEditorWithStateManagement = ({ input, onChange, showDeleteDailog, onServerResponse, closeEditor }: { input: EventEditorInputType, onChange: Function, showDeleteDailog: Function, onServerResponse: Function, closeEditor: Function }) =>{

    /**
     * Jotai
     */

    const dateFormat = useAtomValue(currentSimpleDateFormatAtom)
    const dateFullFormat = useAtomValue(currentDateFormatAtom)
    const showMoveModal = useSetAtom(showMoveEventModal)
    const setMoveEventInput = useSetAtom(moveEventModalInput)

    /**
     * Local State
     */
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [parsedData, setParsedData] = useState<any>(null)
    const [alarms, setAlarms] = useState<AlarmType[]>([])
    const [summary, setSummary]= useState("")
    const [allDay, setAllDay] = useState(false)
    const [calendar_id, setCalendarID] = useState('')
    const [calendarDisabled, setCalendarDisabled] =useState(false)
    const [showMoveEventOption, setShowMoveEventOption]= useState(false)
    const [fromDate, setFromDate]= useState("")
    const [fromDateValid, setFromDateValid] = useState(true)
    const [fromTimeFormat, setFromTimeFormat]= useState("HH:mm")
    const [toDate, setToDate] = useState("")
    const [toDateValid, setToDateValid] = useState(true)
    const [status, setStatus]= useState("")
    const [description, setDescription]= useState("")
    const [rrule, setRrule]= useState<RruleObject>(RRuleHelper.getEmptyObject())
    const [location, setLocation]= useState("")
    const [isNewEvent, setIsNewEvent]= useState(false)
    const [lastModified, setLastModified]= useState("")
    const [isNewTask, setIsNewTask] = useState(false)

    useEffect(()=>{
        let isMounted =true
        if(isMounted){
            processInput()
        }
        return ()=>{
            isMounted=false
        }
    },[])
    const checkInputForNewTask = async () =>{
        if (input) {
            if (!input.id) {
                // New Task.
                if(input.start){
                    setFromDate(input.start)
                }
                if(input.end){
                    setToDate(input.end)
                }

                if(input.calendar_id){
                    setCalendarID(input.calendar_id.toString())
                }else{
                    //Get Default calendar and set.
                    const default_calendar_id = await getDefaultCalendarIDFromLocalStorage()
                    if(default_calendar_id && await isValidCalendarsID(default_calendar_id)){
                        setCalendarID(default_calendar_id)
                    }

                }
            }

            //Process summary input
            if(input.summary){
                setSummary(input.summary)
            }
        }
    }
    const processInput = async() =>{
        if (!input.id) {
            setIsNewEvent(true)
            checkInputForNewTask()
            return
        }

        const eventInfoFromDexie = await getEventFromDexieByID(parseInt(input.id.toString()))
        if (eventInfoFromDexie && Array.isArray(eventInfoFromDexie) && eventInfoFromDexie.length > 0) {
            const unParsedData = eventInfoFromDexie[0].data
            const parsedData = getParsedEvent(unParsedData)
            // console.log(parsedData)
            setSummary(parsedData["summary"])
            setFromDate(moment(parsedData["start"]).toISOString())
            setToDate(moment(parsedData["end"]).toISOString())
            if(moment(parsedData["end"]).unix()-moment(parsedData["start"]).unix()>=86400){
                setAllDay(true)
            }
            if(eventInfoFromDexie[0].calendar_id){
                setCalendarID(eventInfoFromDexie[0].calendar_id)
                setCalendarDisabled(true)
                setShowMoveEventOption(true)
            }
            setDescription(parsedData["description"])
            setLastModified(moment(parsedData["dtstamp"]).format(dateFullFormat))
            setLocation(parsedData["location"])
            if(parsedData["rrule"]){
                setRrule(rruleToObject(parsedData.rrule))
            }
            getVAlarms(unParsedData)
        }

        checkInputForNewTask()
        
    }

    const getVAlarms = async (data) => {
        const url_api = getAPIURL() + "misc/parseics"

        const authorisationData = await getAuthenticationHeadersforUser()
        const requestOptions =
        {
            method: 'POST',
            body: JSON.stringify({ "ics": data}),
            mode: 'cors' as RequestMode,
            headers: new Headers({ 'authorization': authorisationData, 'Content-Type': 'application/json' }),
        }
            fetch(url_api, requestOptions)
                .then(response => response.json())
                .then((body) => {
                    //console.log(body)
                    var message = getMessageFromAPIResponse(body)
                    if(varNotEmpty(message) && varNotEmpty(message["VCALENDAR"]) && Array.isArray(message["VCALENDAR"]) && message["VCALENDAR"].length>0 && varNotEmpty(message["VCALENDAR"][0].VEVENT) && varNotEmpty(message["VCALENDAR"][0].VEVENT[0].VALARM) && Array.isArray(message["VCALENDAR"][0].VEVENT[0].VALARM) && message["VCALENDAR"][0].VEVENT[0].VALARM.length>0 )
                    {
                        //Has Alarms
                        // console.log("alarms", message)
                        let alarms: AlarmType[]=[]
                        for (const i in message["VCALENDAR"][0].VEVENT[0].VALARM)
                        {
                            let parsedAlarm = parseVALARMTIME(message["VCALENDAR"][0].VEVENT[0].VALARM[i])
                            alarms.push(parsedAlarm)
                        }
                        setAlarms(alarms)
                    }

                }).catch (e=> {
                    console.warn("",e)
                }) 

    }

    const isValidEvent = () => {

        if (!summary) {
            toast.error(i18next.t("CANT_CREATE_EMPTY_TASK"))
            return false
        }

        if (!fromDate ||  !toDate) {
            toast.error(i18next.t("EVENT_NEEDS_BOTH_FROM_AND_TO"))
            return false
        }

       
        if(!toDateValid){
            toast.error(i18next.t("ERROR_DUE_DATE_INVALID"))
            return false
        }
        // console.log("taskStartValid", taskStartValid)
        // console.log("dueDateValid", dueDateValid)
        if(!fromDateValid){
            toast.error(i18next.t("ERROR_START_DATE_INVALID"))
            return false
        }

        const endUnix = moment(toDate).unix()
        var startUnix = moment(fromDate).unix()

        if (endUnix < startUnix) {
            toast.error(i18next.t("ERROR_ENDDATE_SMALLER_THAN_START"))
            return false
        }


        if (!calendar_id) {
            toast.error(i18next.t("ERROR_PICK_A_CALENDAR"))
            return false
        }

        return true
    }

    const calendarSelected = (value) =>{
        setCalendarID(value)
    }
    const saveButtonClicked = async () =>{
        let finalFromDate = fromDate
        let finalToDate = toDate
        if(allDay){
            finalFromDate = moment(fromDate).startOf("day").toISOString()
            finalToDate = moment(toDate).add(1, "day").startOf("day").toISOString()
        }

        let eventData = {summary: summary, start: finalFromDate, end: finalToDate, status: status, description: description, rrule: rrule, location: location, alarms: alarms}
        
        if(isValidEvent()){
            // console.log("calendar_id", finalFromDate, finalToDate)
            eventData = addAdditionalFieldsFromOldEventV2(eventData, parsedData)
            const obj = getObjectForAPICallV2(eventData)
            const ics = await makeGenerateICSRequest({ obj })
            if(process.env.NEXT_PUBLIC_DEBUG_MODE==="true") console.log(eventData, ics)
            if(ics){
                setIsSubmitting(true)
                if(isNewEvent){
                    saveNewEvent(ics)
                }else{
                    if(input.id){

                        const etag = await getEtagFromEventID_Dexie(input.id)
                        if (!etag) {
                            console.error("Etag is null!")
                            toast.error(i18next.t("ERROR_GENERIC"))
    
                        }
                        const eventURL = await getEventURLFromDexie(parseInt(input.id.toString()))
    
                        updateTodoLocal(calendar_id, eventURL, etag, ics)
                    }
                }
            }

        }


    }
    const saveNewEvent = async (ics) => {
        const message = summary ? summary + ": " : ""
        toast.info(message + i18next.t("ACTION_SENT_TO_CALDAV"))

        let fileName = getRandomString(64) + ".ics"
        const calendarFromDexie = await getCalendarbyIDFromDexie(parseInt(calendar_id))
        if (calendarFromDexie && calendarFromDexie.length > 0) {
            let url = calendarFromDexie[0].url
            if (url) {
                const lastChar = url.substr(-1);
                if (lastChar != '/') {
                    url = url + '/';
                }

                url += fileName
            }
            const etag = getRandomString(32)

            const caldav_accounts_id = await getCalDAVAccountIDFromCalendarID_Dexie(calendar_id)
            postNewEvent(calendar_id, ics, etag, caldav_accounts_id, calendarFromDexie[0].ctag, calendarFromDexie[0]["syncToken"], calendarFromDexie[0]["url"], "VTODO", fileName).then((body) => {
                onServerResponse(body, summary)
            })
            closeEditor()

        }

    }

    const updateTodoLocal = async (calendar_id, url, etag, data) => {
        const message = summary ? summary + ": " : ""
        toast.info(message + i18next.t("ACTION_SENT_TO_CALDAV"))
        const oldEvent = await preEmptiveUpdateEvent(calendar_id, url, etag, data, "VEVENT")
        const caldav_accounts_id = await getCalDAVAccountIDFromCalendarID_Dexie(calendar_id)

        updateEvent(calendar_id, url, etag, data, caldav_accounts_id, "VEVENT", oldEvent).then((body) => {
            onServerResponse(body, summary)

        })
        closeEditor()

    }

    const copyMoveClicked = () =>{
        setMoveEventInput({
            id: input.id
        })
        closeEditor()
        showMoveModal(true)
    }

    const alarmsChanged = (newAlarmsArray) =>{
        setAlarms(newAlarmsArray)
    }
    const allDaySwitched = (e) =>{
        setAllDay(e.target.checked)
    }
    const fromDateChanged = (value,isValid) =>{
        setFromDate(value)
        setFromDateValid(isValid)
        onChange()

    }
    const endDateChanged = (value,isValid) =>{
        setToDate(value)
        setToDateValid(isValid)
        onChange()
    }

    const statusSelected = (e) =>{
        setStatus(e.target.value)

    }

    const onRruleSet = (rrule) =>{
        const newRRULE = RRuleHelper.parseObject(rrule)
        setRrule(newRRULE)
        onChange()
        // setRrule(e.target.value)

    }

    const deleteEvent = () =>{
        showDeleteDailog()
    }
    return(
        <>
        <div style={{textAlign:"right"}}>
        {isSubmitting ? (<div style={{ textAlign: "center" }}> <Loading centered={true} /></div>) : (<div><Button size="sm" onClick={saveButtonClicked} >{i18next.t("SAVE")}</Button> </div>)}
        </div>
        <h3>{i18next.t("EVENT_SUMMARY")}</h3>
                <Form.Control onChange={(e)=>setSummary(e.target.value)} value={summary} />
        <br />
        <h3>{i18next.t("CALENDAR")}</h3>
            <CalendarPicker disabled={calendarDisabled} onSelectedHook={calendarSelected} calendar_id={calendar_id} />
            {showMoveEventOption ? <p onClick={copyMoveClicked} style={{textAlign:"end", color:PRIMARY_COLOUR, fontSize: 14, }}>{i18next.t("COPY_MOVE")}</p> : null }
            <br />
            <Form.Check
                type="switch"
                label={i18next.t("ALL_DAY_EVENT")}
                checked={allDay}
                onChange={allDaySwitched}
            />
        <br />
        <h3>{i18next.t("FROM")}</h3>
            <Datepicker showDateOnly={allDay} isRequired={true} value={fromDate} onChangeHook={fromDateChanged} />
        <br />
        <h3>{i18next.t("TO")}</h3>
            <Datepicker showDateOnly={allDay} isRequired={true} value={toDate} onChangeHook={endDateChanged}  />
        <br />

        <h3>{i18next.t("STATUS")}</h3>
        <Form.Select onChange={statusSelected} value={status}>
            <option value=""></option>
            <option value="TENTATIVE">{i18next.t("TENTATIVE")}</option>
            <option value="CONFIRMED">{i18next.t("CONFIRMED")}</option>
            <option value="CANCELLED">{i18next.t("CANCELLED")}</option>

        </Form.Select>
        <br />
        <h3>{i18next.t("DESCRIPTION")}</h3>
            <Form.Control value={description} onChange={(e)=>setDescription(e.target.value)} as="textarea" rows={3} />
        <br />
        <Recurrence onRruleSet={onRruleSet} rrule={rrule} />
        <br />
        <h3>{i18next.t("ALARMS")}</h3>
            <AlarmForm onChange={alarmsChanged} alarmsArray={alarms} />
        <br />
        <h3>{i18next.t("LOCATION")}</h3>
        <Form.Control onChange={(e)=>setLocation(e.target.value)} value={location} />
        <br />
        {isSubmitting ? <Loading centered={true} /> : <div onClick={deleteEvent} style={{ color: 'red', marginTop: 20, textAlign: "center" }}>{i18next.t("DELETE_EVENT")}</div>}
        <br />
        <br />
        <p style={{ textAlign: "center" }}><b>{i18next.t('LAST_MODIFIED') + ": "}</b>{lastModified}</p>
        <br />
        </>
    )

}