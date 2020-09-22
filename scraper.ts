import axios from 'axios'
import { DateTime } from 'luxon'
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as readline from 'readline'
import * as sgMail from '@sendgrid/mail'

require('dotenv').config()
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

type ForumUrl = string

function getForumUrlFromSearchTerm(searchTerm: string): ForumUrl {
    if (searchTerm.length < 3) {
        throw new TypeError("forum search term must be at least 3 characters long")
    }

    const formattedSearchTerm = encodeURIComponent(searchTerm).replace("%20", "+")
    return `https://www.eastdulwichforum.co.uk/forum/search.php?9,search=${formattedSearchTerm},page=1,match_type=ALL,match_dates=1,match_forum=THISONE`
}

async function getForum(url: ForumUrl) {
    try {
        const response = await axios.get<string>(url)
        return response.data
    } catch (error) {
        console.error(error)
    }
}

type ForumPosting = {
    timePosted: DateTime,
    postTitle: string,
    postLink: string
}

function parseForum(forumHtml: string): Array<ForumPosting> {
    const $ = cheerio.load(forumHtml)

    const latestPosts: Array<ForumPosting> = []

    $('.PhorumStdBlock > .PhorumRowBlock').each((_idx, element) => {
        const timeOfPost = $(".PhorumColumnFloatLarge", element).text()
        const timeObject = DateTime.fromFormat(timeOfPost, "dd/MM/yyyy HH:mm", { zone: "Europe/London" })
        const postTitle = $(".PhorumLargeFont", element).text()
        const postLink = $(".PhorumLargeFont > a", element).attr('href')

        if (postTitleIsNotAReply(postTitle)) {
            latestPosts.push({
                timePosted: timeObject, postTitle, postLink
            })
        }
    })

    return latestPosts
}

function postTitleIsNotAReply(postTitle: string) {
    return !postTitle.includes("Re: ")
}

async function checkForumForNewPosts(searchTerms: Array<string>) {
    searchTerms.forEach(async term => {
        console.log(`searching for new posts for search term: ${term}`)
        const url = getForumUrlFromSearchTerm(term)
        const forum = await getForum(url)
        const parsed = parseForum(forum)

        const anHourAgo = DateTime.local().minus({ hours: 1 })

        parsed.filter(post => post.timePosted >= anHourAgo).forEach(post => {
            console.log(`Post found: ${post.postTitle}. Sending e-mail notification...`)

            const msg = {
                to: process.env.MAIL_TO_ADDRESS,
                from: process.env.MAIL_FROM_ADDRESS,
                subject: `New thread on forum for term: ${term}`,
                html: `<p>A new thread has been found on the forum matching the search term <strong>${term}</strong> at ${post.timePosted}</p><p><a href="${post.postLink}">${post.postTitle}</a></p>`
            };

            sgMail.send(msg);
        })
    })
}

async function readSearchTermsFromFile() {
    fs.accessSync('terms.txt')
    const fileStream = fs.createReadStream('terms.txt')

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    })

    const searchTerms = []

    for await (const term of rl) {
        searchTerms.push(term)
    }

    return searchTerms
}

async function main() {
    const terms = await readSearchTermsFromFile()
    checkForumForNewPosts(terms)
}

main()
