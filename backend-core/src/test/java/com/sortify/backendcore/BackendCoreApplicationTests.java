package com.sortify.backendcore;

import com.sortify.candidate.entity.Candidate;
import com.sortify.candidate.repository.CandidateRepository;
import com.sortify.common.CandidateStatus;
import com.sortify.common.JobStatus;
import com.sortify.common.Role;
import com.sortify.job.entity.Job;
import com.sortify.job.repository.JobRepository;
import com.sortify.user.entity.User;
import com.sortify.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class BackendCoreApplicationTests {

    static {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private CandidateRepository candidateRepository;

    @Test
    void contextLoads() {
    }

    @Test
    @Transactional
    void persistsCoreDomainRelationships() {
        User user = userRepository.save(User.builder()
                .email("day1-4@example.com")
                .passwordHash("hash")
                .role(Role.RECRUITER)
                .build());

        Job job = jobRepository.save(Job.builder()
                .user(user)
                .title("Backend Engineer")
                .jd("Build reliable backend systems")
                .status(JobStatus.OPEN)
                .build());

        Candidate candidate = candidateRepository.save(Candidate.builder()
                .job(job)
                .name("Example Candidate")
                .email("candidate@example.com")
                .score(87.5)
                .status(CandidateStatus.PENDING)
                .build());

        assertThat(candidate.getId()).isNotNull();
        assertThat(candidateRepository.findById(candidate.getId()))
                .get()
                .extracting(Candidate::getJob)
                .extracting(Job::getUser)
                .extracting(User::getEmail)
                .isEqualTo("day1-4@example.com");
    }

    @Test
    @Transactional
    void rejectsDuplicateUserEmail() {
        userRepository.saveAndFlush(User.builder()
                .email("duplicate@example.com")
                .passwordHash("hash")
                .role(Role.RECRUITER)
                .build());

        assertThatThrownBy(() -> userRepository.saveAndFlush(User.builder()
                .email("duplicate@example.com")
                .passwordHash("another-hash")
                .role(Role.RECRUITER)
                .build()))
                .isInstanceOf(RuntimeException.class);
    }

}
