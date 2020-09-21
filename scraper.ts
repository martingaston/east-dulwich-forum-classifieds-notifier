import axios from 'axios'
import { DateTime } from 'luxon'
import * as cheerio from 'cheerio'

let url = 'https://www.eastdulwichforum.co.uk/forum/search.php?9,search=king+bed,page=1,match_type=ALL,match_dates=30,match_forum=THISONE'

async function getForum() {
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
        const timeObject = DateTime.fromFormat(timeOfPost, "dd/MM/yyyy HH:mm", { zone: "Europe/London"})
        const postTitle = $(".PhorumLargeFont", element).text()
        const postLink = $(".PhorumLargeFont > a", element).attr('href')

        if (!postTitle.includes("Re: ")) {
            latestPosts.push({
                timePosted : timeObject, postTitle, postLink
            })
        }
    })

    return latestPosts
}

async function readForum() {
    const forum = await getForum()
    const parsed = parseForum(forum)

    const anHourAgo = DateTime.local().minus({hours: 1})

    parsed.filter(post => post.timePosted >= anHourAgo).forEach(post => console.log(post))
}

readForum()